const { geminiConfig } = require('../config/gemini') ;

// Single integration point for the Gemini API.
// history : [{ role : 'user' | 'model' , text : String }]
// Returns : { answer : String , stubbed : Boolean }
exports.askGemini = async ({ systemPrompt, history, question }) => {

  // -------- STUB MODE : no real API key configured yet --------
  // Lets the whole pipeline (auth -> context assembly -> persistence)
  // be built and tested with zero external dependencies.
  if (geminiConfig.isStubMode) {
    return {
      answer :
        `[STUB MODE] No Gemini API key configured yet. ` +
        `I would answer: "${question}" using ${history.length} prior message(s) ` +
        `and ${systemPrompt.length} characters of course context.` ,
      stubbed : true ,
    } ;
  }

  const response = await fetch(
    `${geminiConfig.endpoint(geminiConfig.model)}?key=${geminiConfig.apiKey}` ,
    {
      method : 'POST' ,
      headers : { 'Content-Type' : 'application/json' } ,
      body : JSON.stringify({
        systemInstruction : { parts : [{ text : systemPrompt }] } ,
        contents : [
          ...history.map((m) => ({ role : m.role , parts : [{ text : m.text }] })) ,
          { role : 'user' , parts : [{ text : question }] } ,
        ] ,
        generationConfig : { maxOutputTokens : geminiConfig.maxOutputTokens } ,
      }) ,
    }
  ) ;

  if (!response.ok) {
    const errBody = await response.text() ;
    throw new Error(`Gemini API error ${response.status}: ${errBody}`) ;
  }

  const data = await response.json() ;
  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text ;
  if (!answer) {
    throw new Error('Gemini returned no answer (possibly blocked by safety filters)') ;
  }
  return { answer , stubbed : false } ;
} ;
