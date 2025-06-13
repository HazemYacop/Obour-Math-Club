# Obour Math Club

This repository contains the source code of the Obour STEM Math Club official website. It is a Node.js application built with [Express](https://expressjs.com/) and [EJS](https://ejs.co/) templates. The site provides resources about mathematics courses, blogs, research articles and contact forms.

## Project structure

- `index.js` – main Express application entry point.
- `api/` – exports the Express app for serverless deployment.
- `views/` – EJS templates.
- `public/` – static assets such as styles, images and files.

## Development

1. Copy `.env.example` to `.env` and fill the environment variables.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   or simply
   ```bash
   node index.js
   ```

## Deployment

The project can be deployed on platforms such as Vercel. `vercel.json` is included for configuration.

## Contributing

Contributions are welcome! Please ensure code is formatted using [Prettier](https://prettier.io/) and follows clean code practices.

## License

This project is licensed under the ISC License.
