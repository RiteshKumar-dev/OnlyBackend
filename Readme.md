# Advanced MERN Backend

## 🚀 Overview
This is an advanced backend built using **Node.js, Express, and MongoDB** with a robust authentication system, file upload capabilities, and powerful aggregation pipelines. It is designed to handle videos, images, PDFs, and more, ensuring secure and scalable backend operations.

## ✨ Features
- **Authentication & Authorization**  
  - OTP-based authentication
  - Email verification
  - JWT token authentication
- **File Uploads**  
  - Support for **videos, images, PDFs**
  - Cloud and local storage options
- **MongoDB Aggregation Pipelines**  
  - Advanced data querying and filtering
- **Email Notifications**  
  - Send emails for verification and notifications
- **Security & Performance**  
  - Rate limiting, CORS, and input validation
- **Scalability & Optimization**  
  - Efficient database schema and indexing

## 🛠️ Technologies Used
- **Node.js** (Backend runtime)
- **Express.js** (Fast and minimalist framework)
- **MongoDB** (Database with Mongoose ODM)
- **Multer** (File uploads handling)
- **JWT** (Token-based authentication)
- **Nodemailer** (Email sending)
- **Cloudinary/AWS S3** (Optional cloud storage)

## 📌 Installation
1. Clone the repository:
   ```sh
   git clone https://github.com/yourusername/yourrepo.git
   cd yourrepo
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Configure environment variables (`.env` file):
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   EMAIL_SERVICE=your_email_service
   EMAIL_USER=your_email
   EMAIL_PASS=your_email_password
   ```
4. Start the server:
   ```sh
   npm start
   ```

## 📌 API Endpoints
### 🔑 Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/otp-verify` - Verify OTP for authentication
- `POST /api/auth/token-refresh` - Refresh JWT token

### 📁 File Upload
- `POST /api/upload/image` - Upload an image
- `POST /api/upload/video` - Upload a video
- `POST /api/upload/pdf` - Upload a PDF file

### 📊 Data Aggregation
- `GET /api/data/stats` - Get advanced data analytics using MongoDB aggregation

## 🔒 Security Measures
- Encrypted passwords using **bcrypt.js**
- JWT-based secure authentication
- Secure headers and rate limiting

## 🤝 Contributing
Feel free to fork and contribute! Submit a PR with new features or fixes.

## 📜 License
This project is open-source and available under the **MIT License**.

---
💡 **Want to collaborate?** Reach out via email at `riteshkumar555sah@gmail.com` 🚀

