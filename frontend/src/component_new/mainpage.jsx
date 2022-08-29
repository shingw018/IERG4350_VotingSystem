import React, { Component } from "react";
import { Link } from "react-router-dom";

class MainPage extends Component {
  render() {
    return (
      <div className="container">
        <div className="container my-3">
          <Link to="/createVote">
            <button type="button" className="btn btn-primary btn-lg btn-block">
              Create Vote
            </button>
          </Link>
        </div>
        <div className="container my-3">
          <Link to="/joinVote">
            <button type="button" className="btn btn-warning btn-lg btn-block">
              Join Vote
            </button>
          </Link>
        </div>
        <div className="container my-3">
          <Link to="/checkVoteResults">
            <button type="button" className="btn btn-info btn-lg btn-block">
              Check Vote Results
            </button>
          </Link>
        </div>
      </div>
    );
  }
}

export default MainPage;
