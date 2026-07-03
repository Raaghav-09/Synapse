const mongoose = require('mongoose') ;

// One chat session per (student , course).
// messages is capped in the controller so context and storage stay bounded.
const chatSessionSchema = new mongoose.Schema({
  user : {
    type : mongoose.Schema.Types.ObjectId ,
    ref : 'User' ,
    required : true ,
  } ,
  course : {
    type : mongoose.Schema.Types.ObjectId ,
    ref : 'Course' ,
    required : true ,
  } ,
  messages : [
    {
      role : { type : String , enum : ['user', 'model'] , required : true } ,
      text : { type : String , required : true } ,
      createdAt : { type : Date , default : Date.now } ,
    } ,
  ] ,
} , { timestamps : true }) ;

chatSessionSchema.index({ user : 1 , course : 1 } , { unique : true }) ;

module.exports = mongoose.model('ChatSession', chatSessionSchema) ;
