//import dependencies
const express = require("express");
const crypto = require("crypto");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const sqlite = require("sqlite3");
const bcrypt = require("bcrypt");

const app = express();

app.set("view engine", "pug"); //use the pug viewengine
app.use(express.json()); //parses incoming requests into json format

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions",
    }),
    secret: process.env.sessionSecret,
    name: "sid",
    resave: false,
    saveUninitialized: true, //THIS FIXED THE FUCKING PROBLEM!!!!! //MAYBE FIND COMMAND FOR INITIALIZE??
    cookie: {
      sameSite: true,
      maxAge: 1000 * 60 * 60 * 168, //168 hour (how long you can stay remembered for)
      secure: false,
    },
  })
); //this is the express-sessions middleware that keeps track of user sessions

const db = new sqlite.Database("./database.db", sqlite.OPEN_READWRITE, (err) => {
  if (err) console.log("can not connect to database", err)
}); //connect to sqlite database

function esc(string) {
  return string.replace(/'/g, "''");
  //THIS: .replace(/'/g,"''") replaces all 's with '', which skips the ' character and prevents errors where the a variable includes a string with the ' symbol, which would mess up the sql syntax if it wasn't for this.
}

const redirectToLogin = (req, res, next) => {
  //used to redirect the user to the loginpage if he tries to access something that might need an account
  if (req.session.username === undefined) {
    //if user isnt logged in, redirect him to the login page
    res.redirect("/");
  } else {
    next();
  }
};

const redirectToHome = (req, res, next) => {
  //used to redirect the user to the homepage if he is logged in and tries to log in again without logging out first
  if (req.session.username != undefined) {
    //if user is logged in, redirect him to the home page
    res.redirect("/");
  } else {
    next();
  }
};

//create the entire dsatabase system
/*
db.run("CREATE TABLE users (username VARCHAR(15) PRIMARY KEY NOT NULL, password VARCHAR(128) NOT NULL, pfp VARCHAR(200) NOT NULL)");
db.run("CREATE TABLE posts (id VARCHAR(255) PRIMARY KEY, community_name VARCHAR(15) NULL, score INTEGER NOT NULL DEFAULT 0, author_username VARCHAR(15) NOT NULL, header TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (author_username) REFERENCES users(username), FOREIGN KEY (community_name) REFERENCES communities(name))");
db.run("CREATE TABLE post_interactions (username VARCHAR(15) NOT NULL, interaction_type TINYINT NOT NULL, post_id VARCHAR(255) NOT NULL, PRIMARY KEY (username, post_id), FOREIGN KEY (username) REFERENCES users(username), FOREIGN KEY (post_id) REFERENCES posts(id))");
db.run("CREATE TABLE post_comments (id VARCHAR(255) PRIMARY KEY, username VARCHAR(15) NOT NULL, post_id VARCHAR(255) NOT NULL, parent_comment_id VARCHAR(255) NULL, comment TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (username) REFERENCES users(username), FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY(parent_comment_id) REFERENCES post_comments(id))");
db.run("CREATE TABLE comment_interactions (username VARCHAR(15) NOT NULL, interaction_type TINYINT NOT NULL, comment_id VARCHAR(255) NOT NULL, PRIMARY KEY (username, comment_id), FOREIGN KEY (username) REFERENCES users(username), FOREIGN KEY (comment_id) REFERENCES post_comments(id))");
db.run("CREATE TABLE post_images (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, image VARCHAR(200) NOT NULL, FOREIGN KEY (post_id) REFERENCES posts(id))");
db.run("CREATE TABLE communities (name VARCHAR(15) PRIMARY KEY NOT NULL, description TEXT NOT NULL, community_leader_username VARCHAR(15) NOT NULL)");
db.run("CREATE TABLE user_communities (user_username VARCHAR(15) NOT NULL, user_karma INTEGER NOT NULL, community_name VARCHAR(15) NOT NULL, FOREIGN KEY (user_username) REFERENCES users(username), PRIMARY KEY (user_username, community_name))");
db.run("CREATE TABLE user_followers (user_username VARCHAR(15) NOT NULL, follower_username VARCHAR(15) NOT NULL, FOREIGN KEY (user_username) REFERENCES users(username), FOREIGN KEY (follower_username) REFERENCES users(username), PRIMARY KEY(user_username, follower_username))");
*/

const PORT = 3000;
app.listen(PORT, () => console.log(`listening at ${PORT}`));

//

function UpdatePostScore(postID) {
  const query = "SELECT json_object('timestamp', p.timestamp, 'author_followers', (SELECT COUNT(user_username) FROM user_followers WHERE user_username = p.author_username), 'likes', (SELECT COUNT(username) FROM post_interactions WHERE interaction_type = 1 AND post_id = p.id), 'dislikes', (SELECT COUNT(username) FROM post_interactions WHERE interaction_type = 2 AND post_id = p.id), 'comments', (SELECT COUNT(username) FROM post_comments WHERE post_id = p.id)) AS post FROM posts p WHERE id = ?"
  db.all(query, [postID], (err, result) => {
    if (err) console.error(err);
    const updateQuery = "UPDATE posts SET score = ? WHERE id = ?"
    db.run(updateQuery, [GetPostScore(JSON.parse(result[0].post)), postID])
  })
}

function GetPostScore(post) {
  
  //post needs a .timestamp, .likes, .dislikes and .comments and .author_followers
  let score = 3000;
  let lifetime = new Date() - new Date(post.timestamp);
  score *= ((post.likes + post.comments) / (post.likes + post.dislikes + 1)); //likeratio
  score -= lifetime / (100 * 60 * 1) //minus the amount of 1 minute intervals since posted
  score += post.author_followers / 10; //update this to something better
  
  return Math.round(score);
}

app.get("/logOut", redirectToLogin, (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("/", (req, res) => {
  if (req.session.username === undefined) {
    res.render("welcome-page");
  } else {
    const query = "SELECT pfp FROM users WHERE username = ?";
    db.all(query, [req.session.username], (err, result) => {
      if (err) console.log("err, ", err);
      res.render("feed", {
          //pass variables that may render on the webpage
          pfp: result[0].pfp,
          username: req.session.username,
      });
    }) 
  }
})

app.get("/c/:community", redirectToLogin, (req, res) => {
  const community = req.params.community;
  const query = "SELECT * FROM communities WHERE name = ?";
  db.all(query, [community], (err, result) => {
    console.log(result);
    if (result.length == 0) res.render("error-page");
    else res.render("community", {
      name: community,
      description: result[0].description,
      leader: result[0].community_leader_username
    })
    
  })
})

app.get("/p/:username", redirectToLogin, (req, res) => {
  const username = req.params.username;
  const query = "SELECT u.pfp, json_object('followers', (SELECT COUNT(*) FROM user_followers WHERE user_username = u.username), 'following', (SELECT COUNT(*) FROM user_followers WHERE follower_username = u.username)) AS info, json_group_array(json_object('id', p.id, 'community', p.community_name, 'score', score, 'interactions', json_object('likes', json_object('count', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 1 AND pi.post_id = p.id), 'toggled', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 1 AND pi.post_id = p.id AND pi.username = ?)), 'dislikes', json_object('count', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 2 AND pi.post_id = p.id), 'toggled', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 2 AND pi.post_id = p.id AND pi.username = ?))), 'author_username', p.author_username, 'timestamp', p.timestamp, 'header', p.header, 'content', p.content, 'images', (SELECT json_group_array(i.image) FROM post_images i WHERE i.post_id = p.id))) AS posts FROM posts p JOIN users u ON u.username = p.author_username WHERE p.author_username IN(?) LIMIT 1000"
  db.all(query, [req.session.username, req.session.username, username], (err, result) => {
    if(err) console.log(err)
    const posts = JSON.parse(result[0].posts);
    posts.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp)
    }) 
    const info = JSON.parse(result[0].info)
    res.render("profile", {
      username: username,
      pfp: result[0].pfp,
      following: info.following,
      followers: info.followers,
      posts: posts,
    })
  })
})

app.get("/p/:username/:postID", redirectToLogin, (req, res) => {
  const {username, postID} = req.params;
  
})

app.get("/settings", redirectToLogin, (req, res) => {
  const user = req.session.username;
  db.all(
    `SELECT pfp FROM users WHERE username = ?`, [user],
    (err, result) => {
      res.render("settings", {
        pfp: result[0].pfp,
        user: user,
      });
    }
  );
});

app.post("/settings/pfp", redirectToLogin, (req, res) => {
  const newURL = String(req.body.url);
  db.run(
    `UPDATE users SET pfp = ? WHERE username = ?`, [newURL, req.session.username],
    (err) => {
      if (err) {
        console.log(err);
      } else {
        res.json({ failed: false, url: newURL });
      }
    }
  );
});

app.post("/makePost", redirectToLogin, async (req, res) => {
  const { header, content, images, communityName } = req.body;
  const postString = `P-${req.session.username}-${Date.now()}-${Math.floor(Math.random() * 100000000000000)}`
  const postID = crypto.createHash('sha256').update(postString).digest('hex').substring(0, 20);
  
  try {
    // Start a transaction
    await db.run('BEGIN TRANSACTION');

    // Insert post
    const postInsertQuery = "INSERT INTO posts (id, community_name, header, content, author_username) VALUES (?, ?, ?, ?, ? )";
    await db.run(postInsertQuery, [postID, communityName, header, content, req.session.username]);

    //interactions, comments add later
    
    // Insert post images
    for (let i = 0; i < images.length; i++) {
      const postImageInsertQuery = "INSERT INTO post_images (post_id, image) VALUES (?, ?)";
      await db.run(postImageInsertQuery, [postID, images[i]]);
    }

    // Commit transaction
    await db.run('COMMIT');
  } catch (error) {
    console.error(error);
    console.log("ERROR, ROLLING BACK")
    // Rollback transaction if error occurs
    await db.run('ROLLBACK');
    res.json({failed: true, error: error, message: "Something went wrong, please try again"})
  }
  res.json({failed: false});
});



app.get("/register", redirectToHome, (req, res) => {
  res.render("register")
})

app.get("/login", redirectToHome, (req, res) => {
  res.render("login");
})

app.post("/getFeed", redirectToLogin, (req, res) => {
  const {communityName, selectedFeed} = req.body;
  
  if (communityName == null) {
    //get posts from "Following or "trending".
    //get the following feed;
    let allPosts = [];
    const query = `SELECT json_group_array(user_username) AS following FROM user_followers WHERE follower_username = ?`;
    db.all(query, [req.session.username], async (err, result) => {
      //result is now a list of everyone that this user follows.
      let following = JSON.parse(result[0].following);
      if (following.length === 0) {
        res.json({failed: false, posts: allPosts}) //immediately return if not following anyone
        return;
      }
      let questionMarkList = "?";
      for(let i = 1; i < following.length; i++) {
        questionMarkList += ", ?"
      }
      const postsQuery = "SELECT json_group_array(json_object('id', p.id, 'pfp', u.pfp, 'community', p.community_name, 'score', score, 'interactions', json_object('likes', json_object('count', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 1 AND pi.post_id = p.id), 'toggled', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 1 AND pi.post_id = p.id AND pi.username = ?)), 'dislikes', json_object('count', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 2 AND pi.post_id = p.id), 'toggled', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 2 AND pi.post_id = p.id AND pi.username = ?))), 'author_username', p.author_username, 'timestamp', p.timestamp, 'header', p.header, 'content', p.content, 'images', (SELECT json_group_array(i.image) FROM post_images i WHERE i.post_id = p.id))) AS posts FROM posts p JOIN users u ON u.username = p.author_username WHERE p.author_username IN (" + questionMarkList + ") LIMIT 1000"
      db.all(postsQuery, [req.session.username, req.session.username].concat(following), (err, post_result) => {
        if (err) console.log(err)
        const posts = JSON.parse(post_result[0].posts)
        if (selectedFeed == "trending") {
          posts.sort((a, b) => {
            return b.score - a.score;
          })
        } else {
          posts.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp)
          }) 
        }
        res.json({failed: false, posts: posts})
      })
    })
      
      
  } else {
    //get posts from a community(communityName)
    //I MADE THAT QUERY PRETTY MUCH MYSELF lol
    const postsQuery = "SELECT json_group_array(json_object('id', p.id, 'pfp', u.pfp, 'community', p.community_name, 'score', p.score, 'interactions', json_object('likes', json_object('count', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 1 AND pi.post_id = p.id), 'toggled', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 1 AND pi.post_id = p.id AND pi.username = ?)), 'dislikes', json_object('count', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 2 AND pi.post_id = p.id), 'toggled', (SELECT COUNT(*) FROM post_interactions pi WHERE pi.interaction_type = 2 AND pi.post_id = p.id AND pi.username = ?))), 'author_username', p.author_username, 'timestamp', p.timestamp, 'header', p.header, 'content', p.content, 'images', (SELECT json_group_array(i.image) FROM post_images i WHERE i.post_id = p.id))) AS posts FROM posts p JOIN users u ON u.username = p.author_username WHERE community_name = ? LIMIT 1000"
    db.all(postsQuery, [req.session.username, req.session.username, communityName], (err, result) => {
      let posts = JSON.parse(result[0].posts);
        if (selectedFeed == "trending") {
          posts.sort((a, b) => {
            return b.score - a.score;
          })
        } else {
          posts.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp)
          }) 
        }
      res.json({failed: false, posts: posts});
    })
  }
})


app.post("/registerUser", (req, res) => {
  const {username, password} = req.body;
  
  //return if password is too short
  if (password.length <= 5) res.json({ failed: true, usrTaken: false, passFail: true });
  const invalidChars = ["'", "`", '"', ",", " ", "-"]; //characters who are invalid in a username
  
  const query = "SELECT username FROM users WHERE username = ?";
  db.all(query, [username], async (err, result) => {
      if (result.length === 0 && !invalidChars.some(char => username.includes(char))) {
        //there are no users with the same name so, the username is availible and we will proceed
        //hash password:
        const hashedPassword = await bcrypt.hash(password, 10);
        //add NEW user to database, empty values except for a template post
        //
        const defaultPFPS = ["https://i.imgur.com/tUqOH9t.png", "https://i.imgur.com/77XRCpT.png", "https://i.imgur.com/fwnKWZQ.png", "https://i.imgur.com/wuksmEf.png", "https://i.imgur.com/MQAkVkL.png"]
        const defaultPFP_URL = defaultPFPS[Math.floor(Math.random() * defaultPFPS.length)]; //random one of the default pfps
        //convert an image to a blob that can be stored in sqlite
        const query = "INSERT INTO users (username, password, pfp) VALUES (?, ?, ?)"
        db.run(query, [username, hashedPassword, defaultPFP_URL], (err) => {
          if(err) res.json({failed: true, usrTaken: true})
          //everyone will follow themselves when they create their account.
          const followThemselfQuery = `INSERT INTO user_followers (user_username, follower_username) VALUES (?, ?)`
          db.run(followThemselfQuery, [req.body.username, req.body.username], (err) => {
            err ? res.json({failed: true, usrTaken: true}) : res.json({failed: false})
          })
        })
        } else {
        //username is taken, respond with that information
        res.json({ failed: true, usrTaken: true }); //send back status message
      }
    }
  );
})

app.post("/loginUser", redirectToHome, (req, res) => {
  const {username, password} = req.body;
  
  const query = "SELECT * FROM users WHERE username = ?"
  db.all(query, [username], async (err, result) => {
    if (result.length === 1) {
      if (await bcrypt.compare(password, result[0].password)) {
        req.session.username = username; //saves the account you logged into by the username
        req.session.save(); //save the session
        res.json({ failed: false });
      } else {
        res.json({failed: true});
      }
    } else {
      res.json({failed: true})
    }
  })
})

app.post("/interactPost", redirectToLogin, (req, res) => {
  const {interactionType, postID} = req.body;
  const query = "SELECT interaction_type FROM post_interactions WHERE username = ? AND post_id = ?"
  db.all(query, [req.session.username, postID], async (err, result) => {
    let addInteraction = false;
    let removeOldInteraction = false;
    if (result.length == 0 || result[0].interaction_type != interactionType) addInteraction = true;
    if (result.length > 0) removeOldInteraction = true;
    
    if (removeOldInteraction) {
      const removeQuery = "DELETE FROM post_interactions WHERE username = ? AND post_id = ?"
      await db.run(removeQuery, [req.session.username, postID])
    }
    if (addInteraction) {
      const addQuery = "INSERT INTO post_interactions (username, interaction_type, post_id) VALUES (?, ?, ?)"
      await db.run(addQuery, [req.session.username, interactionType, postID])
    }
    
    UpdatePostScore(postID)
    
  })
  
})

app.post("/followUser", redirectToLogin, (req, res) => {
  const existsQuery = "SELECT username, uf.user_username AS following FROM users LEFT OUTER JOIN user_followers uf ON uf.follower_username = ? AND uf.user_username = ?  WHERE USERNAME = ?"
  db.all(existsQuery, [req.session.username, req.body.userToFollow, req.body.userToFollow], async (err, result) => {
    if (result.length === 0) {
      res.json({userExists: false, userFollowed: false});
    } else if (result[0].following !== null) {
      const query = "DELETE FROM user_followers WHERE user_username = ? AND follower_username = ?";
      await db.run(query, [req.body.userToFollow, req.session.username])
      res.json({userExists: true, userFollowed: true, message: "Successfully Unfollowed " + req.body.userToFollow});
    }
    else {
      const query = "INSERT INTO user_followers(user_username, follower_username) VALUES (?, ?)"
      await db.run(query, [req.body.userToFollow, req.session.username])

      res.json({userExists: true, userFollowed: false, message: "Successfully Followed " + req.body.userToFollow}) 
    }
  })
})

app.post("/search", redirectToLogin, async (req, res) => {
  const {query, results} = req.body;
  let searchResults = {users: [], communities: []};
  
  /*const db_query = "SELECT json_group_array(username), json_group_array(c.name) AS communities FROM users LEFT OUTER JOIN communities c ON c.name LIKE '%' || ? || '%' WHERE username LIKE '%' || ? || '%'";
  await db.all(db_query, [query, query], (err, result) => {
    if (err) console.error(err);
    res.json({result: result});
  })*/
  
  let promises = [];
  //results is an array of what types of results you want back from the search, for example users or communities
  if (results.includes("users")) {
    const db_query = "SELECT json_group_array(json_object('username', username, 'pfp', pfp, 'following', (SELECT COUNT(*) FROM user_followers WHERE user_username = username AND follower_username = ?))) AS users FROM users WHERE username LIKE '%' || ? || '%' LIMIT 50";
    promises.push(new Promise((resolve, reject) => {
      db.all(db_query, [req.session.username, query], (err, result) => {
        console.log(err)
        searchResults.users = JSON.parse(result[0].users)
        resolve();
      })
    }))
  }
  if (results.includes("communities")) {
    const db_query = "SELECT json_group_array(json_object('name', name, 'member', (SELECT COUNT(*) FROM user_communities WHERE user_username = ? AND community_name = name))) AS communities FROM communities WHERE name LIKE '%' || ? || '%' LIMIT 50";
    promises.push(new Promise((resolve, reject) => {
      db.all(db_query, [req.session.username, query], (err, result) => {
        console.log(result)
        searchResults.communities = JSON.parse(result[0].communities);
        resolve();
      })
    }))
  }
  await Promise.all(promises);
  res.json({result: searchResults})
})

app.post("/createCommunity", redirectToLogin, (req, res) => {
  const {communityDesc, communityName, communityLeader} = req.body;
  const checkQuery = `SELECT username, c.name AS community FROM users LEFT OUTER JOIN communities c ON c.name = ? WHERE username = ?`;
  db.all(checkQuery, [communityName, communityLeader], async (err, result) => {
    if (err) console.error(err);
    if (result.length === 0 || result[0].username == null) {
      res.json({failed: true, message: "Invalid leader"})
    } else if(result[0].community != null) {
      res.json({failed: true, message: "Community already exists"});
    } else {
      //valid, insert into database
      const insertQuery = `INSERT INTO communities (name, description, community_leader_username) VALUES (?, ?, ?)`;
      const joinQuery = "INSERT INTO user_communities (user_username, user_karma, community_name) VALUES (?, ?, ?)"
      await db.run(insertQuery, [communityName, communityDesc, communityLeader]);
      await db.run(joinQuery, [req.session.username, 100, communityName]);
      res.json({failed: false, message: "Successfully created community"});
    }
  })
})

app.post("/joinCommunity", redirectToLogin, (req, res) => {
  const name = req.body.name;
  const query = "INSERT INTO user_communities (user_username, user_karma, community_name) VALUES (?, ?, ?)"
  db.run(query, [req.session.username, 0, name], async (err) => {
    if (err) {
      //joining failed because not unique error, so run a query to leave community and return the status
      const deleteQuery = "DELETE FROM user_communities WHERE user_username = ? AND community_name = ?"
      await db.run(deleteQuery, [req.session.username, name])
      res.json({message: "Successfully left community " + name});
      
    } else {
      res.json({message: "Successfully joined community " + name})
    }
  })
})

app.get("/getUserCommunities", redirectToLogin, (req, res) => {
  const query = "SELECT json_group_array(community_name) AS communities FROM user_communities WHERE user_username = ?";
  db.all(query, [req.session.username], (err, result) => {
    res.json({communities: JSON.parse(result[0].communities)});
  })
})

app.get("/getUserFriends", redirectToLogin, (req, res) => {
  const query = "SELECT json_group_array(json_object('username', user_username, 'pfp', (SELECT pfp FROM users WHERE username = user_username))) AS friends FROM user_followers WHERE follower_username = ?"
  db.all(query, [req.session.username], (err, result) => {
    res.json({friends: JSON.parse(result[0].friends)})
  })
})