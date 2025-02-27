const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { createClient } = require('redis');

// Create a Redis client
const redisClient = createClient({
  username: 'default',
  password: '1FQbLOuQTGJjc8V56mHDdobMXXm9WjQp',
  socket: {
    host: 'redis-12397.c13.us-east-1-3.ec2.redns.redis-cloud.com',
    port: 12397,
  },
});

// Handle Redis connection errors
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect to Redis
(async () => {
  await redisClient.connect();
  console.log('Connected to Redis');
})();

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Retrieve the Telegram bot token from the environment variable
const botToken = process.env.TELEGRAM_BOT_TOKEN;

// Create the Telegram bot instance
const bot = new TelegramBot(botToken, { polling: true });

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const welcomeMessage = `Hello, ${username}!\n\n`
    + 'Welcome to the URL Shortener Bot!\n'
    + 'You can use this bot to shorten URLs using the TinyEarn service.\n\n'
    + 'To shorten a URL, just type or paste the URL directly in the chat, and the bot will provide you with the shortened URL.\n\n'
    + 'If you haven\'t set your TinyEarn API token yet, use the command:\n/setarklinks YOUR_TINYEARN_API_TOKEN\n\n'
    + 'Now, go ahead and try it out!';

  bot.sendMessage(chatId, welcomeMessage);
});

// Command: /setarklinks
bot.onText(/\/setarklinks (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userToken = match[1].trim(); // Get the API token provided by the user

  // Save the user's TinyEarn API token to Redis
  await redisClient.set(`user:${chatId}:token`, userToken);

  const response = `TinyEarn API token set successfully. Your token: ${userToken}`;
  bot.sendMessage(chatId, response);
});

// Listen for any message (not just commands)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // If the message starts with "http://" or "https://", assume it's a URL and try to shorten it
  if (messageText && (messageText.startsWith('http://') || messageText.startsWith('https://'))) {
    await shortenUrlAndSend(chatId, messageText);
  }
});

// Function to shorten the URL and send the result
async function shortenUrlAndSend(chatId, Url) {
  // Retrieve the user's TinyEarn API token from Redis
  const arklinksToken = await redisClient.get(`user:${chatId}:token`);

  if (!arklinksToken) {
    bot.sendMessage(chatId, 'Please provide your TinyEarn API token first. Use the command: /setarklinks YOUR_TINYEARN_API_TOKEN');
    return;
  }

  try {
    const apiUrl = `https://tinyearn.com/api?api=${arklinksToken}&url=${Url}`;
    const response = await axios.get(apiUrl);
    console.log('API Response:', response.data);

    if (response.data.error) {
      bot.sendMessage(chatId, `API Error: ${response.data.error}`);
      return;
    }

    const shortUrl = response.data.shortenedUrl;
    const responseMessage = `Shortened URL: ${shortUrl}`;
    bot.sendMessage(chatId, responseMessage);
  } catch (error) {
    console.error('Shorten URL Error:', error);
    bot.sendMessage(chatId, 'An error occurred while shortening the URL. Please check your API token and try again.');
  }
}

// Function to validate the URL format
function isValidUrl(url) {
  const urlPattern = /^(|ftp|http|https):\/\/[^ "]+$/;
  return urlPattern.test(url);
}
