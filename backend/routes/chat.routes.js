// routes/chat.routes.js - Updated with your preferred system prompts
const express = require('express');
const router = express.Router();
const Chat = require('../models/chat.model');
const Patient = require('../models/patient.model');
const OpenAI = require('openai');

// Configure OpenAI (Only if API key is set)
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Get chat by link ID
router.get('/:linkId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ chatLinkId: req.params.linkId })
      .populate('patient', 'name age gender');
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send message
router.post('/:linkId/message', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    // Find chat
    const chat = await Chat.findOne({ chatLinkId: req.params.linkId }).populate('patient', 'name age gender');
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Add user message
    const userMessage = {
      sender: 'user',
      content,
      timestamp: new Date(),
    };
    
    chat.messages.push(userMessage);
    
    // Default bot response in case OpenAI is not configured
    let botResponse = "I've received your message. However, our AI system is currently offline. Your information has been recorded and will be shared with your doctor.";
    
    // Get OpenAI response if configured
    if (openai) {
      try {
        // YOUR PREFERRED SYSTEM PROMPT FOR CONVERSATION
        const conversationSystemPrompt = `You are GPT, an intelligent assistant designed to conduct a prescreening medical interview for patients seeking help from a doctor. You play a key role in gathering detailed and accurate information from the patient, which helps reduce the resolution time for the doctor. Follow these rules during the interaction:
1. **Role and Goal:**
   - Your role is limited to gathering information, not diagnosing or prescribing treatment.
   - The objective is to collect enough relevant information in no more than 6 questions to assist the doctor.
2. **Interaction Flow:**
   - Ask concise and relevant questions based on the patient's responses.
   - Tailor follow-up questions dynamically to gather maximum useful information.
3. **Tone and Clarity:**
   - Be professional yet empathetic.
   - Ensure your questions are simple and easy for the patient to understand.
You are not the doctor and must always emphasize that your role is only to gather information to assist the doctor. Your priority is to reduce the doctor's resolution time by ensuring all relevant data is collected efficiently.

Patient details: Name: ${chat.patient.name}, Age: ${chat.patient.age}, Gender: ${chat.patient.gender}`;

        const messages = [
          {
            role: 'system',
            content: conversationSystemPrompt,
          },
          ...chat.messages.map((msg) => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content,
          })),
        ];
        
        // Updated OpenAI API call
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
        });
        
        botResponse = completion.choices[0].message.content;
      } catch (openaiError) {
        console.error('Error with OpenAI:', openaiError);
        // Continue with the default response if OpenAI fails
      }
    } else {
      console.log('OpenAI not configured, using default response');
    }
    
    // Add bot message
    const botMessage = {
      sender: 'bot',
      content: botResponse,
      timestamp: new Date(),
    };
    
    chat.messages.push(botMessage);
    
    // Save chat
    await chat.save();
    
    res.json({
      userMessage,
      botMessage,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate chat summary
router.post('/:linkId/summary', async (req, res) => {
  try {
    // Find chat
    const chat = await Chat.findOne({ chatLinkId: req.params.linkId })
      .populate('patient');
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Default summary in case OpenAI is not configured
    let summary = "Chat summary not available. Please review the full conversation.";
    
    // Generate summary with OpenAI if configured
    if (openai) {
      try {
        // YOUR PREFERRED SYSTEM PROMPT FOR SUMMARY GENERATION
        const summarySystemPrompt = `You are GPT, an intelligent assistant designed to create a summary of a prescreening medical interview for doctors. Your task is to analyze the chat transcript and provide a structured summary to assist the doctor.

Your output must follow this exact format with these clearly labeled headings:

**Symptoms:**
- [List key symptoms reported by the patient]

**Incident History:**
- [Summarize any incidents, accidents, or triggers reported]

**Medications/Treatment:**
- [List medications or treatments the patient has tried]

**Medical History:**
- [Summarize relevant medical history mentioned]

**Key Action Points:**
- [Suggest key areas for the doctor to focus on]

**Probable Tests:**
- [Suggest possible tests that might be relevant based on symptoms]

The summary should be clear, concise, and focused on helping the doctor quickly understand the patient's situation. Do not include diagnoses or treatment recommendations.

Patient details: Name: ${chat.patient.name}, Age: ${chat.patient.age}, Gender: ${chat.patient.gender}`;

        // Extract the conversation transcript
        const chatTranscript = chat.messages.map((msg) => 
          `${msg.sender === 'user' ? 'Patient' : 'AI'}: ${msg.content}`
        ).join('\n\n');

        const messages = [
          {
            role: 'system',
            content: summarySystemPrompt,
          },
          {
            role: 'user',
            content: `Please analyze and summarize this chat transcript for the doctor:\n\n${chatTranscript}`,
          },
        ];
        
        // Updated OpenAI API call
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages,
        });
        
        summary = completion.choices[0].message.content;
      } catch (openaiError) {
        console.error('Error with OpenAI:', openaiError);
        // Continue with the default summary if OpenAI fails
      }
    } else {
      console.log('OpenAI not configured, using default summary');
    }
    
    // Save summary
    chat.summary = summary;
    chat.status = 'completed';
    await chat.save();
    
    // Update patient visit with summary
    const patient = await Patient.findById(chat.patient._id);
    if (patient && patient.visits.length > 0) {
      const lastVisitIndex = patient.visits.length - 1;
      patient.visits[lastVisitIndex].chatSummary = summary;
      await patient.save();
    }
    
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Keep the test route for now
router.get('/test', (req, res) => {
  res.json({ message: 'Chat route is working' });
});

module.exports = router;