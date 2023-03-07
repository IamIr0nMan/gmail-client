# Gmail Client

- It is a gmail client which responds to emails automatically when new message comes.

- It checks for new messages at random interval between 45 and 120 seconds.

- Uses Google auth login and gmail apis to implement these features.

## How to setup and run this project

- Clone this repo
- Run `npm install` in the project folder
- Change name of file `tokens-sample.json` to `tokens.json`
- Get oAuth credentials from google cloud console. Download the json file from there, rename it to `credentials.json` and move it in the project folder
- Run the project using `node server.js`
- Open `http://localhost:3000/` in the browser
