import React, { Component } from "react";
import { Redirect } from "react-router";
import API from "../middleware/api";
const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("curve25519");

class CreateVote extends Component {
  constructor(props) {
    super(props);
    this.state = {
      created: false, //if created successfully, alert 'success' message
      title: undefined, //change while inputting title
      items: [], //change while inputting items
      emailOfCreator: undefined, //change while inputting creator's email
      participantEmails: [], //change while inputting participants' emails
      error: false,
      errorMessage: undefined,
      spinner: "invisible",
    };

    this.handleCreateSubmit = this.handleCreateSubmit.bind(this);
    this.handleEmailOfCreatorChange = this.handleEmailOfCreatorChange.bind(this);
    this.handleItemsChange = this.handleItemsChange.bind(this);
    this.handleParticipantEmailsChange = this.handleParticipantEmailsChange.bind(this);
    this.handleTitleChange = this.handleTitleChange.bind(this);
  }

  async handleCreateSubmit(e) {
    //send { title, items: ['item'], emailOfCreator, participantEmails: ['email'] }
    e.preventDefault();

    //Start the spinner
    this.setState({ spinner: "visible" });

    //Getting data from this.state
    const { title, emailOfCreator, items, participantEmails } = this.state;

    //Setting vote items
    let itemsToSend = items.split(",").map((item) => {
      return item.replace(/[\s]/, "");
    });

    //Setting participant Emails
    let participantEmailsToSend = participantEmails.split(",").map((item) => {
      return item.replace(/[\s]/, "");
    });

    //Setting data to send
    const dataToSend = { title, items: itemsToSend, emailOfCreator, participantEmails: participantEmailsToSend };

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
      await API.post("/createVote", { data: finalData, serverKey }, {});

      //Set the spinner
      this.setState({ spinner: "invisible" }, () => {
        alert("Created Successfully! Please check your email for the verification code to check the vote results.");
        this.setState({ created: true });
      });
    } catch (ex) {
      document.getElementById("createVoteForm").reset();
      this.setState({ error: true, errorMessage: ex.response.data.message });
    }
  }

  handleEmailOfCreatorChange(e) {
    //console.log('email of creator change: ', e.target.value);
    this.setState({ emailOfCreator: e.target.value });
  }

  handleItemsChange(e) {
    //console.log('items change: ', e.target.value);
    this.setState({ items: e.target.value });
  }

  handleParticipantEmailsChange(e) {
    //console.log('participantEmails change: ', e.target.value);
    this.setState({ participantEmails: e.target.value });
  }

  handleTitleChange(e) {
    //console.log('title change: ', e.target.value);
    this.setState({ title: e.target.value });
  }

  render() {
    if (this.state.created) return <Redirect to="/" />;
    return (
      <div className="container">
        <div className="container">
          <h2 className="text-center m-2">Create Vote</h2>
        </div>
        <div className="contianer">
          <form onSubmit={this.handleCreateSubmit} id="createVoteForm">
            <div className="form-group">
              <label htmlFor="creatorEmail" className="form-label">
                Your Email Address
              </label>
              <input
                type="email"
                className="form-control"
                id="creatorEmail"
                placeholder="your email address"
                onChange={this.handleEmailOfCreatorChange}
                spellCheck="false"
                required
              />
              <small id="creatorEmailHelp" className="form-text text-muted">
                We will never share your email with anyone else.
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="title" className="form-label">
                Vote Title
              </label>
              <input
                type="text"
                className="form-control"
                id="title"
                placeholder="vote title"
                onChange={this.handleTitleChange}
                spellCheck="false"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="items" className="form-label">
                Vote Items
              </label>
              <input
                type="text"
                className="form-control"
                id="items"
                placeholder="vote items"
                onChange={this.handleItemsChange}
                spellCheck="false"
                required
              />
              <small id="voteItemsHelp" className="form-text text-muted">
                item1, item2, item3...
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="participantEmails" className="form-label">
                Participants Email Addresses
              </label>
              <input
                type="text"
                className="form-control"
                id="participantEmails"
                placeholder="participants emails"
                onChange={this.handleParticipantEmailsChange}
                spellCheck="false"
                required
              />
              <small id="participantEmailsHelp" className="form-text text-muted">
                emailAddress1, emailAddress2, emailAddress3...
              </small>
            </div>
            <div className="container">
              {this.state.error && <div className="text-danger">*{this.state.errorMessage}</div>}
            </div>
            <div className="container">
              <div
                className={`spinner-border mx-2 text-secondary ${this.state.spinner}`}
                style={{ float: "right" }}
              ></div>
              <input className="btn btn-md btn-primary" type="submit" value="Create Vote" style={{ float: "right" }} />
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default CreateVote;
