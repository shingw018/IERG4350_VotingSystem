import React, { Component } from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import MainPage from "./component_new/mainpage.jsx";
import CreateVote from "./component_new/createVote.jsx";
import JoinVote from "./component_new/joinVote.jsx";
import CheckVoteResults from "./component_new/checkVoteResults.jsx";

class App extends Component {
  render() {
    return (
      <Router>
        <div className="container">
          <Switch>
            <Route path="/" exact component={MainPage}></Route>
            <Route path="/createVote" component={CreateVote}></Route>
            <Route path="/joinVote" component={JoinVote}></Route>
            <Route path="/checkVoteResults" component={CheckVoteResults}></Route>
          </Switch>
        </div>
      </Router>
    );
  }
}

export default App;
