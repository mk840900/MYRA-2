const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("."));

const MEMORY_FILE = path.join(__dirname, "myra-memory.json");

const systemPrompt = `
You are MYRA, a friendly personal AI companion.

User name: Manoj.

Communication:
- Understand Hindi, Hinglish and simple English.
- Reply naturally like a friendly person.
- Prefer simple Hindi/Hinglish when the user uses Hindi/Hinglish.
- Do not translate every sentence literally.
- Do not produce strange or meaningless Hindi.
- Do not repeat the same sentence.
- Keep normal replies concise.
- Answer the actual question.
- Never invent memories.
`;

function loadMemory() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            return JSON.parse(
                fs.readFileSync(MEMORY_FILE, "utf8")
            );
        }
    } catch (error) {
        console.log("Memory load error");
    }

    return {
        name: "Manoj",
        learning: "",
        facts: []
    };
}

function saveMemory() {
    try {
        fs.writeFileSync(
            MEMORY_FILE,
            JSON.stringify(memory, null, 2)
        );
    } catch (error) {
        console.log("Memory save error");
    }
}

let memory = loadMemory();

let conversation = [];

function normalize(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[?!.,।]/g, "");
}

function detectLearning(text) {
    const t = normalize(text);

    if (t.includes("python") || t.includes("पाइथन")) {
        return "Python";
    }

    if (
        t.includes("javascript") ||
        t.includes("java script")
    ) {
        return "JavaScript";
    }

    if (t.includes("html")) {
        return "HTML";
    }

    if (t.includes("css")) {
        return "CSS";
    }

    if (
        t.includes("node js") ||
        t.includes("nodejs")
    ) {
        return "Node.js";
    }

    if (
        t.includes("physics") ||
        t.includes("फिजिक्स") ||
        t.includes("भौतिकी")
    ) {
        return "Physics";
    }

    if (
        t.includes("chemistry") ||
        t.includes("केमिस्ट्री") ||
        t.includes("रसायन")
    ) {
        return "Chemistry";
    }

    if (
        t.includes("math") ||
        t.includes("mathematics") ||
        t.includes("मैथ") ||
        t.includes("गणित")
    ) {
        return "Mathematics";
    }

    return "";
}

function isLearningQuestion(text) {
    const t = normalize(text);

    const patterns = [
        "mai kya sikh",
        "main kya sikh",
        "mai kya seekh",
        "main kya seekh",
        "mai aaj kya sikh",
        "main aaj kya sikh",
        "mai aaj kya seekh",
        "main aaj kya seekh",
        "aaj mai kya sikh",
        "aaj main kya sikh",
        "aaj mai kya seekh",
        "aaj main kya seekh",
        "kya sikh raha",
        "kya sikh rha",
        "kya seekh raha",
        "kya seekh rha",
        "kya padh raha",
        "kya padh rha",
        "what am i learning",
        "what was i learning"
    ];

    return patterns.some(x => t.includes(x));
}

function cleanReply(reply) {
    if (!reply) {
        return "Mujhe abhi jawab nahi mil paya.";
    }

    let text = reply.trim();

    const sentences = text
        .split(/(?<=[.!?।])\s+/)
        .map(x => x.trim())
        .filter(Boolean);

    const unique = [];

    for (const sentence of sentences) {
        if (!unique.includes(sentence)) {
            unique.push(sentence);
        }
    }

    text = unique.join(" ");

    if (text.length > 700) {
        text = text.substring(0, 700);

        const lastSpace = text.lastIndexOf(" ");

        if (lastSpace > 100) {
            text = text.substring(0, lastSpace);
        }

        text += "...";
    }

    return text;
}

function directReply(message) {
    const t = normalize(message);

    if (
        t === "hi" ||
        t === "hii" ||
        t === "hiii" ||
        t === "hello" ||
        t === "hey" ||
        t === "hii myra" ||
        t === "hello myra"
    ) {
        return "Hii Manoj! Kaise ho?";
    }

    if (
        t.includes("kaisi ho") ||
        t.includes("kaise ho") ||
        t.includes("kesi ho") ||
        t.includes("how are you")
    ) {
        return "Main bilkul theek hoon Manoj. Tum kaise ho?";
    }

    if (
        t.includes("kya kar rahi ho") ||
        t.includes("kya kr rahi ho") ||
        t.includes("what are you doing")
    ) {
        return "Main tumse baat kar rahi hoon.";
    }

    if (
        t.includes("mera naam kya hai") ||
        t.includes("my name")
    ) {
        return `Tumhara naam ${memory.name} hai.`;
    }

    if (isLearningQuestion(message)) {
        if (memory.learning) {
            return `Tum ${memory.learning} seekh rahe ho.`;
        }

        return "Abhi mujhe yaad nahi hai ki tum kya seekh rahe the.";
    }

    if (
        t === "python kya hai" ||
        t.includes("python kya hota hai")
    ) {
        return "Python ek programming language hai. Isse apps, websites, automation, AI aur bahut kuch banaya ja sakta hai.";
    }

    const mathMatch =
        t.match(/^(\d+)\s*\+\s*(\d+)$/);

    if (mathMatch) {
        const a = Number(mathMatch[1]);
        const b = Number(mathMatch[2]);

        return `${a} + ${b} = ${a + b}`;
    }

    return null;
}

app.post("/chat", async (req, res) => {
    const message = req.body.message;

    if (
        typeof message !== "string" ||
        !message.trim()
    ) {
        return res.status(400).json({
            error: "Message is required"
        });
    }

    const learning = detectLearning(message);

    if (learning) {
        memory.learning = learning;
        saveMemory();
    }

    const direct = directReply(message);

    if (direct) {
        return res.json({
            reply: direct
        });
    }

    conversation.push({
        role: "user",
        content: message
    });

    if (conversation.length > 12) {
        conversation = conversation.slice(-12);
    }

    const memoryContext = `
User memory:
Name: ${memory.name}
Current learning: ${memory.learning || "unknown"}
`;

    const messages = [
        {
            role: "system",
            content:
                systemPrompt +
                "\n\n" +
                memoryContext
        },
        ...conversation
    ];

    try {
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                error: "GROQ_API_KEY is not configured."
            });
        }

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${process.env.GROQ_API_KEY}`
                },

                body: JSON.stringify({
                    model: "openai/gpt-oss-20b",
                    messages: messages,
                    temperature: 0.4,
                    max_completion_tokens: 300,
                    reasoning_effort: "low"
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.log(
                "Groq AI error:",
                data
            );

            return res.status(500).json({
                error: "Groq AI error"
            });
        }

        let reply =
            data.choices?.[0]?.message?.content;

        reply = cleanReply(reply);

        conversation.push({
            role: "assistant",
            content: reply
        });

        res.json({
            reply: reply
        });

    } catch (error) {
        console.log(
            "Connection error:",
            error.message
        );

        res.status(500).json({
            error:
                "MYRA AI se connect nahi ho pa rahi."
        });
    }
});

app.get("/status", (req, res) => {
    res.json({
        status: "ok",
        memory: memory
    });
});

app.listen(3000, () => {
    console.log("MYRA Brain v3 started");
    console.log("http://127.0.0.1:3000");
});
