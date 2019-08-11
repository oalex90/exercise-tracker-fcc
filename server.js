const express = require('express')
const app = express()
const bodyParser = require('body-parser') //used to get url params and form input values
const mongoose = require('mongoose') //needed for db
const mongo = require('mongodb') //needed for db
const shortid = require('shortid') //used to generate unique userId values

const cors = require('cors')

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true }); //connect to database

var UsersSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true,
    unique: true, //can only have one of each value
    maxlength: [20, "username must be 20 characters or less"]},
  _id: { //overwrite _id value
    type: String,
    default: shortid.generate} //pass function so each new value generates new id
});

var ExercisesSchema = new mongoose.Schema({
  description: {type: String, maxlength: [20, "description must be 20 characters or less"]}, //max length is 20, if not produce error string
  duration: {type: Number, min: [1, "duration must be 1 or greater"]}, //min value is 1 if not produce error string
  date: {type: Date, default: Date.now}, //default date is current Date/time
  username: String,
  userId: {type: String, ref: 'Users', index: true} //references the _id field in the Users table/model
});

var Users = new mongoose.model('Users', UsersSchema);
var Exercises = new mongoose.model("Exercises", ExercisesSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false})) //sets bodyParser up
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post("/api/exercise/new-user", (req, res)=>{ //creating users
  let username = req.body.username; //get username from form input using body-param
  let newUser = {username: username}

  Users.create(newUser, (err, data)=>{ //try to create newUser
    if(err){
      if(err.code == 11000) { //if error code matches one for existing username, send error message
        res.json({error: "username already taken"})
        return;
      } else {
        res.json({error: err.message}); //for other errors, (e.g. over maxlength) print out error message
        return;
      }
    }
    
    res.json({username: data.username, userId: data._id}) //if success, display new User properties
  })
})

app.post('/api/exercise/add', (req, res)=>{ //creating exercises
  let userId = req.body.userId; //get values from form input using body-param
  let description = req.body.description;
  let duration = parseFloat(req.body.duration);
  let date = req.body.date;
  let username;
  
  Users.findById(userId, (err, data)=>{ //search for User by id to make sure it exists
    if(err) console.log("err", err)
    if(!data){ //if no match found, display error
      res.json({error: "userId not found"})
      return;
    }
    username = data.username; //get username from found User
    
    if (date){ //if date is not null convert to Date, if null create a Date using current datetime
      date = new Date(date);
    } else{
      date = new Date();
    }
  
    let newExercise = {
      description: description,
      duration: duration,
      date: date,
      username: username,
      userId: userId
    };
    
    Exercises.create(newExercise, (err, exerciseData)=>{ //try to create new Exercise
      if(err) { //if error, display error message
        res.json({error: err.message})
        return;
      }
      res.json({ //if success display new Exercise properties
        username: exerciseData.username,
        description: exerciseData.description,
        duration: exerciseData.duration,
        userId: exerciseData.userId,
        date: exerciseData.date.toUTCString().substring(0,16)
      })
    })
    
  })
})

app.get('/api/users', (req, res)=>{ //display all Users in db
  Users.find({}, (err, data)=>{
    res.json({users: data})
  })
})

app.get('/api/exercise/log', (req, res)=>{ //display Exercises given userId and filters
  let userId = req.query.userId; //get values from url query using body-param
  let from = new Date(req.query.from);
  let to = new Date(req.query.to);
  let limit = req.query.limit;
  
  if(!userId){ //if userId is null, display error
    res.json({error: "please enter a userId"});
    return;
  }
  if(from > to){//if from date is newer than to date, display error
    res.json({error: "invalid date (from - to) range"})
    return;
  }

  if(limit){ //if limit input, check if valid number, if not display error
    limit = parseInt(limit);
    if(isNaN(limit)){
      res.json({error: "invalid limit"});
      return;
    }
  }

  let lowDate = new Date("100"); //used to min date in from default value
  
  Exercises.find({ //search Exercises using query and filters
    userId: userId, //find Exercises matching the given userId
    date: { //only find Exercises within the given date range ( from - to)
      $lte: to != "Invalid Date" ? to.getTime() : Date.now(), //if no or invalid Date, use current/latest date
      $gte: from != "Invalid Date" ? from.getTime() : lowDate.getTime() //if no or invald Date, use lowest/earliest date
    }})
    .limit(limit) //limit returned values to number given
    .exec((err,data)=>{ //execute command
      if(err){ //if error, display error message
        res.json({error: err.message})
        return;
      }
      let out = { //if success display returned Exercises and their attributes
        userId: userId,
        username: data[0].username,
        count: data.length,
        log: data.map(exercise=>{ //use map to iterate through Exercises
          return {
            description: exercise.description,
            duration: exercise.duration,
            date: exercise.date.toUTCString().substring(0,16)
          }
        })
      };
      res.json(out);
  })
})


// Not found middleware
app.use((req, res, next) => {
  res.json({status: 404, message: 'not found'})
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
