import React, { Component } from "react";
import { Modal } from "react-bootstrap";
import API from "../middleware/api";
import { Bar } from "react-chartjs-2";
const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("curve25519");

class CheckVoteResults extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: { labels: [], datasets: [] }, //for the chart
      error: false, //for wrong passcode
      errorMessage: undefined, //show wrong passcode message
      options: { scales: { yAxes: [{ ticks: { beginAtZero: true } }] } }, //for the chart
      passcode: undefined, //change while inputting the passcode
      title: undefined, //to show the title
      validPasscode: false, //if valid passcode, then show content
    };

    this.getData = this.getData.bind(this);
    this.handlePasscodeChange = this.handlePasscodeChange.bind(this);
    this.handlePasscodeSubmit = this.handlePasscodeSubmit.bind(this);
  }

  getData(items) {
    const voteData = [
      {
        label: "count",
        data: items.map((item) => {
          return item.count;
        }),
        backgroundColor: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        maxBarThickness: 150,
      },
    ];

    const data = {
      labels: items.map((item) => {
        return item.name;
      }),
      datasets: voteData,
    };
    const options = {
      scales: {
        x: {
          title: {
            display: true,
            text: "items",
          },
        },
        y: {
          title: {
            display: true,
            text: "count",
          },
          min: 0,
        },
      },
    };
    this.setState({ validPasscode: true, data, options });
  }

  handlePasscodeChange(e) {
    this.setState({ passcode: e.target.value });
  }

  async handlePasscodeSubmit(e) {
    //Prevent default behaviours (e.g. not showing data in URL)
    e.preventDefault();

    try {
      //Generate own EC key pair
      const clientKeyPair = ec.genKeyPair();

      //Do key exchange
      const resKeyExchange = await API.post("/keyExchange", {
        clientPublicKey: clientKeyPair.getPublic().encode("hex"),
      });
      const serverPublicKey = resKeyExchange.data.serverPublicKey;
      const serverKey = resKeyExchange.data.serverKey;

      //Encrypt the data
      const sharedSecret = clientKeyPair.derive(ec.keyFromPublic(serverPublicKey, "hex").getPublic()).toString(16);
      const encryptedData = CryptoJS.AES.encrypt(this.state.passcode, sharedSecret).toString();
      const authTagData = CryptoJS.HmacSHA256(encryptedData, sharedSecret);
      const finalData = encryptedData + " " + authTagData;

      //Post the passcode and get the data
      const resCheckVoteResults = await API.post("/checkVoteResults", { data: finalData, serverKey }, {});

      //Check the auth tag
      const encryptedDataReturn = resCheckVoteResults.data.split(" ")[0];
      const authTagReturn = resCheckVoteResults.data.split(" ")[1];

      const authTagCalculated = CryptoJS.HmacSHA256(encryptedDataReturn, sharedSecret);
      if (authTagCalculated.toString() !== authTagReturn.toString()) console.log("Bad Auth Tag.");

      //Decrypt the data
      const bytes = CryptoJS.AES.decrypt(encryptedDataReturn, sharedSecret);
      const decodedData = bytes.toString(CryptoJS.enc.Utf8);
      const decryptedData = JSON.parse(decodedData);

      this.setState({
        title: decryptedData.title,
        error: false,
        errorMessage: undefined,
        validPasscode: true,
        passcode: undefined,
      });

      this.getData(decryptedData.items);
    } catch (ex) {
      document.getElementById("checkVoteResultsForm").reset();
      this.setState({ error: true, errorMessage: ex.response.data.message });
    }
  }

  render() {
    return (
      <>
        <Modal show={!this.state.validPasscode} backdrop="static" keyboard={false}>
          <Modal.Header>
            <Modal.Title>Enter a passcode to check the vote result</Modal.Title>
          </Modal.Header>
          <form onSubmit={this.handlePasscodeSubmit} id="checkVoteResultsForm" autoComplete="off">
            <Modal.Body>
              <div className="input-group mb-3">
                <input
                  type="text"
                  name="passcode"
                  className="form-control"
                  placeholder="Enter passcode here"
                  required
                  onChange={this.handlePasscodeChange}
                />
              </div>
              {this.state.error && <div className="text-danger">*{this.state.errorMessage}</div>}
            </Modal.Body>
            <Modal.Footer>
              <input className="btn btn-md btn-primary" type="submit" value="Submit" style={{ float: "right" }} />
            </Modal.Footer>
          </form>
        </Modal>
        {this.state.validPasscode && (
          <div className="container">
            <div className="container">
              <h2 className="text-center">{this.state.title}</h2>
            </div>
            <Bar data={this.state.data} options={this.state.options} />
          </div>
        )}
      </>
    );
  }
}

export default CheckVoteResults;

//modal -> code -> a page showing the data and details of the view
