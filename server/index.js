const express = require('express') ; 
const app = express() ; 

const userRoutes = require('./routes/User') ;
const profileRoutes = require('./routes/Profile') ;
const paymentRoutes = require('./routes/Payments') ;
const courseRoutes = require('./routes/Course') ;
const contactRoutes = require('./routes/Contact') ;
const assistantRoutes = require('./routes/DoubtAssistant') ;

const database = require('./config/database') ; 
const cookieParser = require('cookie-parser') ; 
const cors = require('cors') ;
const helmet = require('helmet') ;
const {cloudinaryConnect} = require('./config/cloudinary') ; 
const fileUpload = require('express-fileupload') ; 
const dotenv = require('dotenv') ; 

dotenv.config() ; 
const PORT = process.env.PORT || 4000 ; 

// database connect
database.connect() ; 
// middlewares
// Baseline security headers (HSTS, X-Content-Type-Options, frameguard, ...).
// crossOriginResourcePolicy is relaxed because media is served from Cloudinary.
app.use(helmet({
  crossOriginResourcePolicy : { policy : 'cross-origin' } ,
})) ;

// Keep the raw request bytes around so the Razorpay webhook can verify its
// HMAC against exactly what was signed, not a re-serialized body.
app.use(express.json({
  verify : (req, res, buf) => { req.rawBody = buf ; } ,
})) ;
app.use(cookieParser()) ;

// Comma-separated list so local dev and the deployed frontend can coexist.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean) ;

app.use(
  cors({
    origin : allowedOrigins ,
    credentials : true
  })
)
app.use(fileUpload({
  useTempFiles : true ,
  tempFileDir : '/tmp' ,
  // Without a cap, one request can stream an unbounded file to disk.
  limits : { fileSize : 100 * 1024 * 1024 } ,   // 100 MB
  abortOnLimit : true ,
  responseOnLimit : 'File is too large (max 100 MB)' ,
})) ;

// cloudinary connection
cloudinaryConnect() ; 

// routes 
app.use('/api/v1/auth' , userRoutes ) ;
app.use('/api/v1/profile' , profileRoutes) ;
app.use('/api/v1/course' , courseRoutes ) ;
app.use('/api/v1/payment' , paymentRoutes) ;
app.use('/api/v1/assistant' , assistantRoutes) ;
app.use('/api/v1/contact' , contactRoutes) ;

// default routes
app.get('/',(req , res) => {
  return res.json({
    success : true , 
    message : "Your server is up and running"
  }) ; 
}) ; 

// activate the server 
app.listen(PORT , () => {
  console.log(`App is running at port ${PORT}`) ; 
})