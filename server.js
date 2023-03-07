const express = require("express");
const fs = require("fs");
const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");

const app = express();

// Load the credentials from the JSON file which was provided while creating the oauth client on Google cloud console.
const credentials = JSON.parse(fs.readFileSync("credentials.json"));

// Creating an oauth client with the credentials
const oauth2Client = new OAuth2Client(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[0]
);

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

app.get("/", (req, res) => {
  let storedCredentials;
  try {
    // Check if access tokens are stored in the file assuming the file is created
    storedCredentials = JSON.parse(fs.readFileSync("tokens.json"));
  } catch (err) {
    console.log("There are no stored credentials");
  }

  // if the token is not stored, i.e. if users have not consented they will be redirected to the consent page
  if (!storedCredentials.access_token) {
    // Redirect the user to Google's OAuth2 consent screen
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
    });
    // After getting the auth url, redirect to it. The redirection url is set on the Google cloud console which hits the '/oauth2callback'
    res.redirect(authUrl);
  } else {
    // the stored tokens are passed to the oauth client object
    oauth2Client.setCredentials(storedCredentials);

    // This will be sent to the user on browser
    res.send("welcome to gmail client");

    // set random interval between 45 to 120 seconds to trigger the fuction to reply to the emails.
    setInterval(
      checkEmailAndReply,
      Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000
    );
  }
});

// After user consents to the permission, this route will be called
app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  // This will get the access token and the refresh token and then it is stored in a file which can be used to fetch those tokens so that user don't have to consent again.
  const { tokens } = await oauth2Client.getToken(code);

  // save the tokens to a file
  fs.writeFileSync("tokens.json", JSON.stringify(tokens));

  // setting the tokens to the oauth client object
  oauth2Client.setCredentials(tokens);

  // Redirect the user to the home page
  res.redirect("/");
});

// This fuction helps fetch all unread mails,send an automated reply to each one of them and label the emails as "Automated Reply"
async function checkEmailAndReply() {
  try {
    // Get the list of unread emails
    const response = await gmail.users.messages.list({
      auth: oauth2Client,
      userId: "me",
      q: "is:unread",
    });

    // if there is no new mail returns from the function
    if (response.data.messages.length == 0) return;

    // Process each email
    for (const email of response.data.messages) {
      // Get the full email message
      const fullEmail = await gmail.users.messages.get({
        auth: oauth2Client,
        userId: "me",
        id: email.id,
      });

      const replyMessage =
        "Thank you for your email. I am currently on vacation and will not be able to respond to your message. I will get back to you as soon as possible.";

      // Send the reply
      await gmail.users.messages.send({
        auth: oauth2Client,
        userId: "me",
        requestBody: {
          raw: Buffer.from(
            `To: ${
              fullEmail.data.payload.headers.find((h) => h.name === "From")
                .value
            }\r\nSubject: ${
              fullEmail.data.payload.headers.find((h) => h.name === "Subject")
                .value
            }\r\n\r\n${replyMessage}`
          ).toString("base64"),
        },
      });

      // fetch the list of labels
      const labels = await gmail.users.labels.list({
        auth: oauth2Client,
        userId: "me",
      });

      // check if there is an existing label named: "Automated Reply"
      const existingLabel = labels.data.labels.find(
        (label) => label.name === "Automated Reply"
      );

      let LABEL_ID;

      // if label does not exists, create it
      if (existingLabel) {
        LABEL_ID = existingLabel.id;
      } else {
        // create new label
        const label = await gmail.users.labels.create({
          auth: oauth2Client,
          userId: "me",
          requestBody: {
            name: "Automated Reply",
          },
        });
        LABEL_ID = label.data.id;
      }

      // Add a label to the email and mark it as read
      await gmail.users.messages.modify({
        auth: oauth2Client,
        userId: "me",
        id: email.id,
        requestBody: {
          addLabelIds: [LABEL_ID],
          removeLabelIds: ["UNREAD"],
        },
      });
    }
  } catch (error) {
    console.error(error);
  }
}

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
