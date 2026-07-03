const express = require('express') ;
const router = express.Router() ;

const { auth, isStudent } = require('../middlewares/auth') ;
const {
  askDoubt ,
  getChatHistory ,
  doubtRateLimiter ,
} = require('../controllers/DoubtAssistant') ;

router.post('/ask', auth, isStudent, doubtRateLimiter, askDoubt) ;
router.get('/history/:courseId', auth, isStudent, getChatHistory) ;

module.exports = router ;
