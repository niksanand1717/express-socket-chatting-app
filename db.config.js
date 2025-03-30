import mongoose from "mongoose";
// Connect to MongoDB
export const connectToDB = () => {
  try {
    const db = mongoose.connect("mongodb://localhost:27017/chatApp", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if connection fails
  }
};
