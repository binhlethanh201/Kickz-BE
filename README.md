# 👟 Kickz - Backend

**Kickz Backend** is the RESTful API service for the Kickz client. Built with Node.js, Express.js, and MongoDB, this backend service powers authentication, product management, order processing, and payment integration with PayOS for the footwear retail application.

## Prerequisites

- Node.js (version 16 or higher) and npm installed on your system
- MongoDB server installed locally or access to a MongoDB Atlas cluster database
- Git for version control
- (Optional) A code editor like VS Code, WebStorm, or Sublime Text
- Basic understanding of JavaScript, Node.js, Express.js, and MongoDB concepts
- Knowledge of RESTful APIs, JWT authentication, and database schemas

## Installation

1. **Clone the repository** (if not already downloaded):

```sh
git clone <repository-url>
cd Kickz-BE

```

2. **Install dependencies**:

```sh
npm install

```

3. **Configure environment variables**:
   Create a `.env` file in the root directory and define the necessary configuration variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key

```

## How to Run

1. **Start the development server** (with hot-reloading using Nodemon):

```sh
npm run dev

```

2. **Start the production server**:

```sh
npm start

```

3. **Run tests**:

```sh
npm test

```

## Technologies

### Backend

- **Node.js**
- **Express.js ^5.2.1**
- **MongoDB with Mongoose ^9.10.2**
- **CORS ^2.8.6**
- **JSON Web Token (jsonwebtoken) ^9.0.3**
- **PayOS Node SDK (@payos/node) ^2.0.5**
- **Morgan ^1.12.1**
- **Moment.js ^2.31.0**
- **dotenv ^18.0.4**

### Development Tools

- **Nodemon ^3.1.14**
- **Prettier ^3.9.9**
- **Husky ^9.1.7**
- **lint-staged ^17.6.0**
- **Git**

## Troubleshooting

- **Database Connection**: Verify your MongoDB URI and ensure the MongoDB service is running
- **Environment Variables**: Make sure the `.env` file exists and contains all required keys
- **Port Conflicts**: Ensure the port specified in `.env` (or default port) is not used by another process
- **Dependencies**: Run `npm install` if any module missing errors occur
- **Payment Gateway**: Verify PayOS Client ID, API Key, and Checksum Key when testing payment flows
- **Console Errors**: Check terminal output for stack traces and error messages

## Contributing

This is a learning project designed for educational purposes. Feel free to:

- Modify examples to experiment with different approaches
- Add new features and functionality
- Improve documentation and comments
- Share your learning experiences
- Report bugs and suggest improvements

## Learn More

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [JSON Web Token (JWT) Documentation](https://jwt.io/introduction)
- [PayOS Developer Documentation](https://payos.vn/docs/)

For questions or contributions, please open an issue or pull request on the GitHub repository.

## License

This project is licensed under the ISC License - see the LICENSE file for details.
