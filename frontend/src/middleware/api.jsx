import axios from "axios";

export default axios.create({
  baseURL: "http://localhost:4000", // for local use
  //baseURL: "http://ec2-52-77-255-166.ap-southeast-1.compute.amazonaws.com:4000"
});
