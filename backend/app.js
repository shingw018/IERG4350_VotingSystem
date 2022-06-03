require("dotenv").config();
require("express-async-errors");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const randomize = require("randomatic");
const nodemailer = require("nodemailer");
const ObjectId = require("mongoose").Types.ObjectId;
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const EC = require("elliptic").ec;
const ec = new EC("curve25519");
const app = express();

//middlewares
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

// connect to database
mongoose.connect(
  "mongodb+srv://shingshing:shing@4350@ierg4350-project.sj5uu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", function () {
  console.log("Connection is open...");
});

// listening to port 4000
app.listen(4000);

//Vote Schema
const VoteSchema = mongoose.Schema({
  title: {
    type: String,
    default: "",
    required: true,
  },
  items: {
    type: [
      {
        name: {
          type: String,
          default: "",
          //required: true
        },
        count: {
          type: String,
          default: "",
          //required: true
        },
      },
    ],
    default: [],
    required: true,
  },
  creatorPasscode: {
    type: String,
    default: "",
    //required: true
  },
  participants: {
    type: [
      {
        participantPasscode: {
          type: String,
          default: "",
          //required: true
        },
        voted: {
          type: Boolean,
          default: false,
          //required: true
        },
      },
    ],
    default: [],
    required: true,
  },
});

const Vote = mongoose.model("Vote", VoteSchema);

//Symmetric encrypt function
const encrypt = (message, key) => {
  const algorithm = "aes-256-gcm";
  const iv = crypto.randomBytes(12); // Initialization vector.

  const cipher = crypto.createCipheriv(algorithm, key, iv, {
    authTagLength: 16,
  });

  let encrypted = cipher.update(message, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  const encryptedToReturn = iv.toString("hex") + tag.toString("hex") + encrypted;

  return encryptedToReturn;
};

//Symmetric decrypt function
const decrypt = (encrypted, key) => {
  const algorithm = "aes-256-gcm";

  const iv = encrypted.slice(0, 24);
  const tag = encrypted.slice(24, 56);
  const encryptedData = encrypted.slice(56);

  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, "hex"), {
    authTagLength: 16,
  });

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  decrypted += decipher.final("utf8");

  return decrypted;
};

//Email Transporter definition
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "shingshing4350@gmail.com",
    pass: "shing@4350",
  },
});

const sendEmailToCreator = (email, title, passcode, website) => {
  //Send emails to creator
  try {
    transporter.sendMail(
      {
        from: "shingshing4350@gmail.com",
        to: email,
        subject: "Passcode to check the vote result",
        text: `
			You just created a vote.
			Vote title: ${title}
			Time Created: ${new Date()}
			Here is the verfification code to check the vote results.
			Verification Code: ${passcode}
			Check the vote results at ${website}
			`,
      },
      function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("訊息發送: " + info.response);
        }
      }
    );
  } catch (error) {
    console.log("inside creator email transporter");
    console.log(error);
  }
};

const sendEmailToParticipant = (email, title, passcode, website) => {
  //Send emails to participants
  try {
    transporter.sendMail(
      {
        from: "shingshing4350@gmail.com",
        to: email,
        subject: `Your are invited to join a vote`,
        text: `
			You are invited to join a vote.
			Vote title: ${title}
			Here is the verfification code to join the vote results.
			Verification Code: ${passcode}
			Join the vote at ${website}
			`,
      },
      function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("訊息發送: " + info.response);
        }
      }
    );
  } catch (error) {
    console.log("inside participants");
    console.log(error);
  }
};

//Gloabl Temp Variable
publicKeyMap = new Map(); //Hex strings
ECKeyMap = new Map(); //EC keys

//routes
app.post("/keyExchange", (req, res) => {
  //Generate server key pairs
  const serverKeyPair = ec.genKeyPair();

  //Set key to recognize the private key and public stored
  const serverKey = process.hrtime.bigint().toString();

  //Save the private key and received public key
  publicKeyMap.set(`publicKey_${serverKey}`, req.body.clientPublicKey);
  ECKeyMap.set(`ECKey_${serverKey}`, serverKeyPair);

  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Return the necessary data
  return res.status(200).json({ serverPublicKey: serverKeyPair.getPublic().encode("hex"), serverKey });
});

app.post("/createVote", async (req, res) => {
  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Website sent in the email
  const website = "http://ec2-52-77-255-166.ap-southeast-1.compute.amazonaws.com";

  //Derive the secret key
  const serverKeyPair = ECKeyMap.get(`ECKey_${req.body.serverKey}`);
  const clientPublicKey = publicKeyMap.get(`publicKey_${req.body.serverKey}`);
  const sharedSecret = serverKeyPair.derive(ec.keyFromPublic(clientPublicKey, "hex").getPublic()).toString(16);

  //Delete the specific item in the Maps
  publicKeyMap.delete(`publicKey_${req.body.serverKey}`);
  ECKeyMap.delete(`ECKey_${req.body.serverKey}`);

  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Check the auth tag
  const encryptedData = req.body.data.split(" ")[0];
  const authTagReceived = req.body.data.split(" ")[1];

  const authTagCalculated = CryptoJS.HmacSHA256(encryptedData, sharedSecret);
  if (authTagCalculated.toString() !== authTagReceived.toString())
    return res.status(400).send({ message: "Bad Auth Tag." });

  //Decrypt the data
  const bytes = CryptoJS.AES.decrypt(encryptedData, sharedSecret);
  const decodedData = bytes.toString(CryptoJS.enc.Utf8);
  const decryptedData = JSON.parse(decodedData);

  //Set the new vote title with encryption
  const newTitle = encrypt(decryptedData.title, process.env.VOTE_TITLE_SECRET_KEY);

  //Set the new vote items with encryption
  const newItems = decryptedData.items.map((item) => {
    return {
      name: encrypt(item, process.env.VOTE_ITEM_NAME_SECRET_KEY),
      count: encrypt("0", process.env.VOTE_ITEM_COUNT_SECRET_KEY),
    };
  });

  //Set the new vote creator passcode
  const newCreatorPasscode = "";

  //Set the new vote participants
  const newParticipants = decryptedData.participantEmails.map(() => {
    return {
      participantPasscode: "",
      voted: false,
    };
  });

  //Set the new vote
  let newVote = new Vote({
    title: newTitle,
    items: newItems,
    creatorPasscode: newCreatorPasscode,
    participants: newParticipants,
  });

  //Save the new vote
  const savedVote = await newVote.save();

  //Setting creator passcode
  const creatorPasscode = savedVote._id + randomize("*", 10);
  console.log("original passcode creator: ", creatorPasscode);

  //Hash the creator passcode
  const salt = await bcrypt.genSalt(10);
  const hashedCreatorPasscode = await bcrypt.hash(creatorPasscode, salt);

  //Setting participants passcode and send emails to participants
  const doHash = savedVote.participants.map(async (participant, index) => {
    //Setting participant passcode
    const participantPasscode = savedVote._id + randomize("*", 10);
    console.log("Original passcode participant: ", participantPasscode);

    //Send email to the participant
    sendEmailToParticipant(decryptedData.participantEmails[index], savedVote.title, participantPasscode, website);

    //Hashing the participant passcode
    const salt = await bcrypt.genSalt(10);
    const hashedPasscode = await bcrypt.hash(participantPasscode, salt);

    //Setting the object to return
    const object = {
      participantPasscode: hashedPasscode,
      voted: participant.voted,
    };
    return object;
  });
  const hashResult = await Promise.all(doHash);

  //Saving the updated Vote
  await Vote.findByIdAndUpdate(
    savedVote._id,
    {
      creatorPasscode: hashedCreatorPasscode,
      participants: hashResult,
    },
    {
      useFindAndModify: false,
      new: true,
    }
  );

  //Send email to creator
  sendEmailToCreator(decryptedData.emailOfCreator, decryptedData.title, creatorPasscode, website);

  //Post request finsihed
  console.log("Post Finished!");

  return res.status(200).json({ message: "Created Successfully" });
});

app.post("/toJoinVote", async (req, res) => {
  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Derive the secret key
  const serverKeyPair = ECKeyMap.get(`ECKey_${req.body.serverKey}`);
  const clientPublicKey = publicKeyMap.get(`publicKey_${req.body.serverKey}`);
  const sharedSecret = serverKeyPair.derive(ec.keyFromPublic(clientPublicKey, "hex").getPublic()).toString(16);

  //Delete the specific item in the Maps
  publicKeyMap.delete(`publicKey_${req.body.serverKey}`);
  ECKeyMap.delete(`ECKey_${req.body.serverKey}`);

  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Check the auth tag
  const encryptedData = req.body.data.split(" ")[0];
  const authTagReceived = req.body.data.split(" ")[1];

  const authTagCalculated = CryptoJS.HmacSHA256(encryptedData, sharedSecret);
  if (authTagCalculated.toString() !== authTagReceived.toString())
    return res.status(400).send({ message: "Bad Auth Tag." });

  //Decrypt the data
  const bytes = CryptoJS.AES.decrypt(encryptedData, sharedSecret);

  //Get the passcode
  const passcode = bytes.toString(CryptoJS.enc.Utf8);

  //Get the voteId
  let voteId = passcode.slice(0, -10);

  //Check valid ObjectId
  const validObjectId = ObjectId.isValid(voteId);
  //Final return statement
  // if(!validObjectId) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (!validObjectId) return res.status(400).json({ message: "Invalid objectId." });

  //Check if vote exist
  const vote = await Vote.findById(voteId, "title items participants");
  //Final return statement
  //if(!vote) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (!vote) return res.status(400).json({ message: "Valid _id. But vote not exist." });

  //Check if passcode/participant exists
  const checkValidParticipant = vote.participants.map(async (participant) => {
    return await bcrypt.compare(passcode, participant.participantPasscode);
  });
  const validateResult = await Promise.all(checkValidParticipant);
  //Final return statement
  //if(!validateResult.includes(true)) return res.status(400).json({ message: 'Invalid passcode.' });
  //Debugging return statement
  if (!validateResult.includes(true))
    return res.status(400).json({ message: "Participant not found. Not allowed to vote." });

  //Check if the passcode is used/participant is voted
  const voted = vote.participants[validateResult.indexOf(true)].voted;
  //Final return statement
  // if(voted) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (voted) return res.status(400).json({ message: "Voted already." });
  const participantId = vote.participants[validateResult.indexOf(true)]._id;

  //Set vote to return
  //First decrypt the data with symmetric decryption
  const title = decrypt(vote.title, process.env.VOTE_TITLE_SECRET_KEY);
  const items = vote.items.map((item) => {
    return decrypt(item.name, process.env.VOTE_ITEM_NAME_SECRET_KEY);
  });

  //Set the item to return
  const itemToReturn = {
    voteId: voteId,
    title: title,
    items: items,
    participantId: participantId,
  };

  //Encrypt the data
  const encryptedDataToReturn = CryptoJS.AES.encrypt(JSON.stringify(itemToReturn), sharedSecret).toString();
  const authTagDataToReturn = CryptoJS.HmacSHA256(encryptedDataToReturn, sharedSecret);
  const finalDataToReturn = encryptedDataToReturn + " " + authTagDataToReturn;

  //Return the item
  return res.status(200).json(finalDataToReturn);
});

app.post("/submitJoinVote", async (req, res) => {
  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Derive the secret key
  const serverKeyPair = ECKeyMap.get(`ECKey_${req.body.serverKey}`);
  const clientPublicKey = publicKeyMap.get(`publicKey_${req.body.serverKey}`);
  const sharedSecret = serverKeyPair.derive(ec.keyFromPublic(clientPublicKey, "hex").getPublic()).toString(16);

  //Delete the specific item in the Maps
  publicKeyMap.delete(`publicKey_${req.body.serverKey}`);
  ECKeyMap.delete(`ECKey_${req.body.serverKey}`);

  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Check the auth tag
  const encryptedData = req.body.data.split(" ")[0];
  const authTagReceived = req.body.data.split(" ")[1];

  const authTagCalculated = CryptoJS.HmacSHA256(encryptedData, sharedSecret);
  if (authTagCalculated.toString() !== authTagReceived.toString())
    return res.status(400).send({ message: "Bad Auth Tag." });

  //Decrypt the data
  const bytes = CryptoJS.AES.decrypt(encryptedData, sharedSecret);
  const decodedData = bytes.toString(CryptoJS.enc.Utf8);
  const decryptedData = JSON.parse(decodedData);

  const voteId = decryptedData.voteId;

  //Check valid ObjectId
  const validObjectId = ObjectId.isValid(voteId);
  //Final return statement
  //if(!validObjectId) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return  statement
  if (!validObjectId) return res.status(400).json({ message: "Invalid objectId." });

  //Check if vote exist
  const vote = await Vote.findById(voteId, "title items participants");
  //Final return statement
  //if(!vote) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (!vote) return res.status(400).json({ message: "Vote not exist." });

  const items = vote.items.map((item) => {
    return {
      name: decrypt(item.name, process.env.VOTE_ITEM_NAME_SECRET_KEY),
      count: decrypt(item.count, process.env.VOTE_ITEM_COUNT_SECRET_KEY),
    };
  });

  //Check if the vote item is valid
  const item = items.filter((item) => item.name === decryptedData.choice);
  if (item.length === 0) return res.status(400).json("Invalid vote item.");

  //Update the item count - count + 1
  const indexOfItem = items.indexOf(item[0]);
  items[indexOfItem].count = (parseInt(items[indexOfItem].count) + 1).toString();

  //Set the new vote items with encryption
  const updatedItems = items.map((item) => {
    return {
      name: encrypt(item.name, process.env.VOTE_ITEM_NAME_SECRET_KEY),
      count: encrypt(item.count, process.env.VOTE_ITEM_COUNT_SECRET_KEY),
    };
  });

  vote.items = updatedItems;

  //Find the participant
  const participant = vote.participants.filter(
    (participant) => participant._id.toString() === decryptedData.participantId.toString()
  );
  const indexOfParticipant = vote.participants.indexOf(participant[0]);

  //Update the participant - voted: true
  vote.participants[indexOfParticipant].voted = true;

  //save the new vote
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      //Define and start a session
      await vote.save({ session: session });
      await session.commitTransaction();

      //Send response
      res.status(201).json({ message: "success" });
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "sessoin error", description: err });
  } finally {
    console.log("Transaction end");
    session.endSession();
  }
});

app.post("/checkVoteResults", async (req, res) => {
  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Derive the secret key
  const serverKeyPair = ECKeyMap.get(`ECKey_${req.body.serverKey}`);
  const clientPublicKey = publicKeyMap.get(`publicKey_${req.body.serverKey}`);
  const sharedSecret = serverKeyPair.derive(ec.keyFromPublic(clientPublicKey, "hex").getPublic()).toString(16);

  //Delete the specific item in the Maps
  publicKeyMap.delete(`publicKey_${req.body.serverKey}`);
  ECKeyMap.delete(`ECKey_${req.body.serverKey}`);

  //Debugging for the Maps
  console.log(`publicKeyMap is ${[...publicKeyMap.keys()]}`);
  console.log(`EC Key Map is ${[...ECKeyMap.keys()]}`);

  //Check the auth tag
  const encryptedData = req.body.data.split(" ")[0];
  const authTagReceived = req.body.data.split(" ")[1];

  const authTagCalculated = CryptoJS.HmacSHA256(encryptedData, sharedSecret);
  if (authTagCalculated.toString() !== authTagReceived.toString())
    return res.status(400).send({ message: "Bad Auth Tag." });

  //Decrypt the data
  const bytes = CryptoJS.AES.decrypt(encryptedData, sharedSecret);

  //Get the passcode
  const passcode = bytes.toString(CryptoJS.enc.Utf8);

  //Get the voteId
  let voteId = passcode.slice(0, -10);

  //Check if ObjectId is valid
  const validObjectId = ObjectId.isValid(voteId);
  //Final return statement
  //if(!validObjectId) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (!validObjectId) return res.status(400).json({ message: "Invalid objectid." });

  //Check if the vote exist
  const vote = await Vote.findById(voteId, "title items creatorPasscode participants");
  //Final return statement
  // if(!vote) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (!vote) return res.status(400).json({ message: "Vote not found." });

  //Check if the passcode is valid
  const validPasscode = await bcrypt.compare(passcode, vote.creatorPasscode);
  //Final return statement
  // if(!validPasscode) return res.status(400).json({message: 'Invalid passcode.'});
  //Debugging return statement
  if (!validPasscode) return res.status(400).json({ message: "passcode not valid." });

  //Decrypt the title
  const title = decrypt(vote.title, process.env.VOTE_TITLE_SECRET_KEY);
  const items = vote.items.map((item) => {
    return {
      name: decrypt(item.name, process.env.VOTE_ITEM_NAME_SECRET_KEY),
      count: decrypt(item.count, process.env.VOTE_ITEM_COUNT_SECRET_KEY),
    };
  });

  //Set the item to return
  const itemToReturn = {
    title: title,
    items: items,
  };

  //Encrypt the data
  const encryptedDataToReturn = CryptoJS.AES.encrypt(JSON.stringify(itemToReturn), sharedSecret).toString();
  const authTagDataToReturn = CryptoJS.HmacSHA256(encryptedDataToReturn, sharedSecret);
  const finalDataToReturn = encryptedDataToReturn + " " + authTagDataToReturn;

  //Return the item
  return res.status(200).json(finalDataToReturn);
});

//Error handling
app.use(function (err, req, res, next) {
  console.log(err.stack);
  res.status(500).json({ message: "Server Error" });
});
