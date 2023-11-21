const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv").config();

const app = express();
const port = process.env.PORT;
const cors = require("cors");

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const jwt = require("jsonwebtoken");

mongoose
    .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Connect success to mongodb");
    })
    .catch((err) => {
        console.error(err);
    });

app.listen(port, () => {
    console.log("server is running on port", port);
});

const User = require("./models/user");
const Note = require("./models/note");

app.post("/register", async (req, res) => {
    // console.log(req.body);
    try {
        const { name, email, password } = req.body;

        console.log(name, email, password);

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res
                .status(400)
                .json({ message: "Email already registered" });
        }

        const newUser = new User({ name, email, password });
        console.log(newUser);
        newUser.verificationToken = crypto.randomBytes(20).toString("hex");

        await newUser.save();

        sendVerificationEmail(newUser.email, newUser.verificationToken);

        res.status(200).json({
            message:
                "Registration successful. Please check your email for verification.",
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "error registering user" });
    }
});

const sendVerificationEmail = async (email, token) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.USER_EMAIL,
            pass: process.env.PASSWORD_EMAIL,
        },
    });

    const mailOptions = {
        from: "tmquang.tech",
        to: email,
        subject: "Email verification",
        text: `Please click the following link to verify your email https://localhost:3000/verify/${token}`,
    };
    await transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error when sending mail", error);
        } else {
            console.log("Email sent: " + info.response);
        }
    });
};

app.get("/verify/:token", async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            return res.status(404).json({ message: "Invalid token" });
        }
        user.verified = true;
        user.verificationToken = undefined;
        res.status(200).json({ message: "Email verified successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Email verification failed" });
    }
});

const generateSecretKey = () => {
    const secretKey = crypto.randomBytes(32).toString("hex");
    return secretKey;
};

const secretKey = generateSecretKey();

app.post("/login", async (req, res) => {
    console.log(req.body);
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "Invalid email." });
        }

        if (user.password != password) {
            return res.status(404).json({ message: "Password is incorrect." });
        }

        const token = jwt.sign({ userId: user._id }, secretKey);
        res.status(200).json({ token });
    } catch (err) {
        console.error(err);
    }
});
