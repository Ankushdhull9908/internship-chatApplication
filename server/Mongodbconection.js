import mongoose from 'mongoose';

const mongodb = async () => {
    try {
        // Ensure you use the correct environment variable
         await mongoose.connect(process.env.MONGOURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("Database connected successfully");
    } catch (error) {
        console.error("Database connection error:", error.message);
        process.exit(1); // Exit the process with failure
    }
};

export default mongodb;
