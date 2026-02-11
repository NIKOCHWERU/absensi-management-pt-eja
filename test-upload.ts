import "dotenv/config";
import { uploadFile } from "./server/services/googleDrive";

async function testUpload() {
    try {
        console.log("Starting test upload...");
        const buffer = Buffer.from("test image content", "utf-8");
        const result = await uploadFile(
            buffer,
            "test.txt",
            "text/plain",
            {
                employeeName: "Test User",
                actionType: "clockIn",
                timestamp: new Date()
            }
        );
        console.log("Upload result:", result);
    } catch (err) {
        console.error("Upload failed:", err);
    }
}

testUpload();
