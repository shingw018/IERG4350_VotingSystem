import React, { Component } from "react";
import { Modal } from "react-bootstrap";
import { Redirect } from "react-router";
import API from "../middleware/api";
const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("curve25519");

class JoinVote extends Component {
  constructor(props) {
    super(props);
    this.state = {
      choice: undefined, //user's choice
      emptyChoiceError: false, //not selected a choice
      error: false, //passcode error
      errorMessage: undefined, //passcode error message
      passcode: undefined, //change while inputting the passcode
      participantId: undefined, //return the participant id
      serverError: false, //is server error, back to main page to vote again
      title: undefined, //get the title
      validPasscode: false, //if valid passcode, show the vote
      items: [], //get the items
      voted: false, //if voted, back to main page
      voteId: undefined, //get the voteId
    };

    this.handlePasscodeChange = this.handlePasscodeChange.bind(this);
    this.handlePasscodeSubmit = this.handlePasscodeSubmit.bind(this);
    this.handleVoteChange = this.handleVoteChange.bind(this);
    this.handleVoteSubmit = this.handleVoteSubmit.bind(this);
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

      const resToJoinVote = await API.post("/toJoinVote", { data: finalData, serverKey }, {});

      //Check the auth tag
      const encryptedDataReturn = resToJoinVote.data.split(" ")[0];
      const authTagReturn = resToJoinVote.data.split(" ")[1];

      const authTagCalculated = CryptoJS.HmacSHA256(encryptedDataReturn, sharedSecret);
      if (authTagCalculated.toString() !== authTagReturn.toString()) console.log("Bad Auth Tag.");

      //Decrypt the data
      const bytes = CryptoJS.AES.decrypt(encryptedDataReturn, sharedSecret);
      const decodedData = bytes.toString(CryptoJS.enc.Utf8);
      const decryptedData = JSON.parse(decodedData);

      this.setState({
        title: decryptedData.title,
        items: decryptedData.items,
        error: false,
        errorMessage: undefined,
        validPasscode: true,
        voteId: decryptedData.voteId,
        participantId: decryptedData.participantId,
        passcode: undefined,
        spinner: "invisible",
      });
    } catch (ex) {
      document.getElementById("joinVotePasscodeForm").reset();
      this.setState({ error: true, errorMessage: ex.response.data.message });
    }
  }

  handlePasscodeChange(e) {
    this.setState({ passcode: e.target.value });
  }

  handleVoteChange(e) {
    //console.log(e.target.value);
    this.setState({ choice: e.target.value, emptyChoiceError: false });
  }

  async handleVoteSubmit(e) {
    //Prevent default behaviours (e.g. not showing data in URL)
    e.preventDefault();

    if (this.state.choice === undefined) return this.setState({ emptyChoiceError: true });

    //Set spinner
    this.setState({ spinner: "visible" });

    //Setting data to send
    const dataToSend = {
      choice: this.state.choice,
      voteId: this.state.voteId,
      participantId: this.state.participantId,
    };

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
      const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(dataToSend), sharedSecret).toString();
      const authTagData = CryptoJS.HmacSHA256(encryptedData, sharedSecret);
      const finalData = encryptedData + " " + authTagData;

      //Send the data and create the vote via doing post request
      await API.post("/submitJoinVote", { data: finalData, serverKey }, {});

      //Set the spinner
      this.setState({ spinner: "invisible" }, () => {
        alert("Voted Successfully!");
        this.setState({ voted: true });
      });
    } catch (ex) {
      alert("Server error!");
      this.setState({ serverError: true });
    }
  }

  render() {
    if (this.state.voted || this.state.serverError) return <Redirect to="/" />;
    return (
      <>
        <Modal show={!this.state.validPasscode} backdrop="static" keyboard={false}>
          <Modal.Header>
            <Modal.Title>Enter a passcode to join a vote</Modal.Title>
          </Modal.Header>
          <form onSubmit={this.handlePasscodeSubmit} id="joinVotePasscodeForm" autoComplete="off">
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
              <h2 className="text-center m-2">Vote</h2>
            </div>
            <div className="contianer">
              <h4 className="text-center m-2">Title: {this.state.title}</h4>
              <form onSubmit={this.handleVoteSubmit} id="joinVoteSubmitForm" autoComplete="off">
                {this.state.items.map((item, index) => {
                  return (
                    <div className="form-check radio" key={index}>
                      <label>
                        <input
                          className="form-check-input"
                          checked={this.state.choice === item}
                          onChange={this.handleVoteChange}
                          name={item}
                          key={index}
                          type="radio"
                          value={item}
                        />
                        {item}
                      </label>
                    </div>
                  );
                })}
                {this.state.emptyChoiceError && <div className="text-danger">*At Least Select One.</div>}
                <div
                  className={`spinner-border mx-2 text-secondary ${this.state.spinner}`}
                  style={{ float: "right" }}
                ></div>
                <input className="btn btn-md btn-primary" type="submit" value="Vote" style={{ float: "right" }} />
              </form>
            </div>
          </div>
        )}
      </>
    );
  }
}

export default JoinVote;
