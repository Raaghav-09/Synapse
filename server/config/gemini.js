require('dotenv').config() ;

// Central place for all Gemini settings. Nothing else in the codebase
// should read GEMINI_* env vars directly.
const apiKey = (process.env.GEMINI_API_KEY || '').trim() ;

exports.geminiConfig = {
  apiKey ,
  model : process.env.GEMINI_MODEL || 'gemini-flash-latest' ,
  endpoint : (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` ,
  maxOutputTokens : 1024 ,
  // true when no real key is present -> geminiService returns canned responses
  isStubMode : !apiKey || apiKey.includes('<your-key-here>') ,
} ;
