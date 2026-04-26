const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Clerk API Credentials
// YAHAN APNI 'sk_test_...' WALI SECRET KEY PASTE KARO
const CLERK_SECRET_KEY = "sk_test_YOFfWMCkiKyunNgMnNYYJ6e1mB6H9gOWXYP5gfcBBB"; 

// 1. Fetch Users Route
app.get('/api/users', async (req, res) => {
    try {
        const response = await fetch('https://api.clerk.com/v1/users', {
            headers: { 'Authorization': `Bearer ${CLERK_SECRET_KEY}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ CLERK API ERROR:", errorText);
            return res.status(500).json({ error: `Clerk API Error: ${response.status}. Terminal check karo.` });
        }

        const users = await response.json();
        const formattedUsers = users.map(u => ({
            id: u.id,
            username: u.username || u.first_name || 'No Name',
            email: u.email_addresses[0]?.email_address || '',
            role: u.public_metadata?.role || 'user',
            created_at: new Date(u.created_at).toISOString()
        }));
        
        res.json(formattedUsers);
    } catch (err) {
        console.error("❌ SERVER ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Change Role Route
app.post('/api/users/role', async (req, res) => {
    const { userId, role } = req.body;
    try {
        await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ public_metadata: { role: role } })
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Execution Route (JS, Python, C++, Java Supported)
app.post('/api/execute', (req, res) => {
    const { language, code, stdin } = req.body;
    
    // Unique ID for files
    const fileId = `${Date.now()}_${Math.floor(Math.random() * 100)}`;
    const inputPath = path.join(__dirname, `temp_${fileId}.in`);
    let codePath = '';
    let command = '';
    let isJava = false;

    // Save stdin to file
    fs.writeFileSync(inputPath, stdin || '');

    // Set file extensions and compile/run commands based on language
    if (language === 'javascript' || language === 'nodejs') {
        codePath = path.join(__dirname, `temp_${fileId}.js`);
        fs.writeFileSync(codePath, code);
        command = `node "${codePath}" < "${inputPath}"`; 
    } 
    else if (language === 'python') {
        codePath = path.join(__dirname, `temp_${fileId}.py`);
        fs.writeFileSync(codePath, code);
        command = `python "${codePath}" < "${inputPath}"`;
    }
    else if (language === 'cpp' || language === 'c++') {
        codePath = path.join(__dirname, `temp_${fileId}.cpp`);
        const exePath = path.join(__dirname, `temp_${fileId}.exe`);
        fs.writeFileSync(codePath, code);
        // Compile then execute
        command = `g++ "${codePath}" -o "${exePath}" && "${exePath}" < "${inputPath}"`;
    }
    else if (language === 'java') {
        isJava = true;
        // Java needs a directory because public class name must match file name (Solution.java)
        const dirPath = path.join(__dirname, `java_${fileId}`);
        fs.mkdirSync(dirPath, { recursive: true });
        codePath = path.join(dirPath, 'Solution.java');
        const javaInputPath = path.join(dirPath, 'input.in');
        
        fs.writeFileSync(codePath, code);
        fs.writeFileSync(javaInputPath, stdin || '');
        
        command = `cd "${dirPath}" && javac Solution.java && java Solution < input.in`;
    }

    const startTime = Date.now();
    
    // Execute Code
    exec(command, { timeout: 8000 }, (error, stdout, stderr) => {
        const runtime = Date.now() - startTime;
        
        // --- Safai Abhiyan (Cleanup Files) ---
        try {
            if (!isJava) {
                if (fs.existsSync(codePath)) fs.unlinkSync(codePath);
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (language === 'cpp' || language === 'c++') {
                    const exePath = path.join(__dirname, `temp_${fileId}.exe`);
                    if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
                }
            } else {
                // Remove Java directory
                const dirPath = path.join(__dirname, `java_${fileId}`);
                if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); // Original input file
            }
        } catch(e) { console.error("Cleanup Error:", e) }

        // Timeout Error Handling
        if (error && error.killed) {
            return res.json({ output: "", error: "Time Limit Exceeded (Timeout)", runtime });
        }

        res.json({
            output: stdout ? stdout.trim() : "",
            error: stderr ? stderr.trim() : (error ? error.message : ""),
            runtime
        });
    });
});

const PORT = 2000;
app.listen(PORT, () => console.log(`🚀 Custom Code Engine running on http://localhost:${PORT}`));