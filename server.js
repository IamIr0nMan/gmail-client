const express = require("express");
const fs = require("fs");
const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");

const app = express();

// Load the credentials from the JSON file which was provided while creating the oauth client on Google cloud console. Also I renamed the file.
const credentials = JSON.parse(fs.readFileSync("credentials.json"));

const oauth2Client = new OAuth2Client(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[0]
);
const gmail = google.gmail({ version: "v1", auth: oauth2Client });

app.get("/", (req, res) => {
  let storedCredentials;
  try {
    storedCredentials = JSON.parse(fs.readFileSync("tokens.json"));
  } catch (err) {
    console.log("There are no stored credentials");
  }

  if (!storedCredentials.access_token) {
    // Redirecting the user to Google's OAuth2 consent screen
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
    });
    res.redirect(authUrl);
  } else {
    oauth2Client.setCredentials(storedCredentials);
    res.send("welcome to gmail client");
  }
  setInterval(
    checkEmailAndReply,
    Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000
  );
});

app.get("/oauth2callback", async (req, res) => {
  // Exchange the authorization code for an access token
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  fs.writeFileSync("tokens.json", JSON.stringify(tokens));
  oauth2Client.setCredentials(tokens);
  // Redirect the user to the home page
  res.redirect("/");
});

async function checkEmailAndReply() {
  if (oauth2Client.isTokenExpiring()) {
    fs.writeFileSync("tokens.json", JSON.stringify("{}"));
    res.redirect("/");
  }
  try {
    // Get the list of unread emails
    const response = await gmail.users.messages.list({
      auth: oauth2Client,
      userId: "me",
      q: "is:unread",
    });
    // Process each email
    if (response.data.messages.length == 0) return;
    for (const email of response.data.messages) {
      // Get the full email message
      const fullEmail = await gmail.users.messages.get({
        auth: oauth2Client,
        userId: "me",
        id: email.id,
      });
      console.log("fetch mail");
      console.log(fullEmail.data.threadId);

      // Generate a reply
      const replyMessage =
        "Thank you for your email. I am currently on vacation and will not be able to respond to your message. I will get back to you as soon as possible.";

      // Send the reply
      const res1 = await gmail.users.messages.send({
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
      console.log("email sent: ", res1);
      const labels = await gmail.users.labels.list({
        auth: oauth2Client,
        userId: "me",
      });

      const existingLabel = labels.data.labels.find(
        (label) => label.name === "Automated Reply"
      );
      console.log("got the label: ", existingLabel);
      let LABEL_ID;
      if (existingLabel) {
        LABEL_ID = existingLabel.id;
        // add the label to the email message
      } else {
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
      const done = await gmail.users.messages.modify({
        auth: oauth2Client,
        userId: "me",
        id: email.id,
        requestBody: {
          addLabelIds: [LABEL_ID],
          removeLabelIds: ["UNREAD"],
        },
      });

      console.log("Added label: ", done);
    }
  } catch (error) {
    console.error(error);
  }
}

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
