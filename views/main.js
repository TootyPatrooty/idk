let lastPost = Date.now();
let isPosting = false;
let selectedFeed = "following";
let allPostsArray = []; //an array of all posts that will be rendered in the feed, changes depending on your "feed settings"
let communityName = null; //the community that you are posting in now

//FUNCTIONS
//-------------


function POST(data) {
  //takes the passed data and packages it into a json object that contains fetching options needed for sending data to the server
  const fetchOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
  return fetchOptions;
}

function openSettings() {
  document.getElementById("settingsMenu").style.display = "flex";
}

function toggleSearchPanel(toggled) {
  const area = document.getElementById("searchArea");
  if (!toggled) {
    document.getElementById("searchInput").style = null;
    area.style.display = "flex";
    setTimeout(`document.getElementById("searchArea").style.height = "100%"`, 1);
  } else {
    document.getElementById("searchResultArea").innerHTML = null;
    document.getElementById("searchInput").value = null;
    document.getElementById("searchInput").style.height = 0;
    document.getElementById("searchInput").style.padding = "0";
    area.style.height = "0";
    setTimeout(`document.getElementById("searchArea").style.display = "none"`, 140);
  }
}

function clickedNewPost() {
  document.getElementById("makePostImageUploader").addEventListener("change", displayUploadedImagesPreview);
  const textContent = document.getElementById("makePostTextContent");
  const container = document.getElementById("makePostContainer");
  textContent.style.display = "flex";
  container.style.height = "350px";
  document.getElementById("makePostAlternativeContainer").style.display = "flex";
  document.getElementById("deselectNewPostButton").innerText = "×"
  document.getElementById("deselectNewPostButton").style.marginRight = "5px"
  document.getElementById("deselectNewPostButton").style.width = "30px"
}

function deselectedNewPost() {
  document.getElementById("makePostImageUploader").value = null;
  document.getElementById("makePostImagePreviewArea").innerHTML = null;
  const textContent = document.getElementById("makePostTextContent");
  const container = document.getElementById("makePostContainer");
  container.style.height = null;
  textContent.style.display = null;
  document.getElementById("makePostAlternativeContainer").style.display = null;
  document.getElementById("deselectNewPostButton").style.marginRight = null;
  document.getElementById("deselectNewPostButton").style.width = null;
  document.getElementById("deselectNewPostButton").innerText = null;
}

function displayUploadedImagesPreview() {
  const imageFiles = [...document.getElementById("makePostImageUploader").files]
  let previewHTML = "";
  for(let i = 0; i < imageFiles.length; i++) {
    previewHTML+=`<img class="aPostInTheFeedImg" src="${URL.createObjectURL(imageFiles[i])}">`;
  }
  document.getElementById("makePostImagePreviewArea").innerHTML = previewHTML;
}

async function makePost() {
  const header = document.getElementById("makePostHeader").value;
  const content = document.getElementById("makePostTextContent").value;
  if (isPosting) return;
  if (
    Date.now() - lastPost > 1000 &&
    (header.length != 0 || content.length != 0) &&
    header.length + content.length < 3000
  ) {
    isPosting = true;
    //take all images and convert them into base64data
    let images = [];
    let uploadedFiles = [...document.getElementById("makePostImageUploader").files]
    console.log(uploadedFiles.length, "uploaded files length")
    for(let i = 0; i < uploadedFiles.length; i++) {
      
      await fetch("https://api.imgur.com/3/image", {
        method: "post",
        headers: {
          Authorization: "Client-ID 24f8e7b40c984de"
        },
        body: uploadedFiles[i]
      }).then(data => data.json()).then(data => {
        images.push(data.data.link)
      })
    }
    console.log(`posting a post with ${images.length} images to the community ${communityName}`)
    const response = await fetch(
      "/makePost",
      POST({ header: header, content: content, images: images, communityName: communityName})
    );
    const data = await response.json();
    if (!data.failed) {
      document.getElementById("makePostHeader").value = null;
      document.getElementById("makePostTextContent").value = null;
      deselectedNewPost();
      lastPost = Date.now();
      document.getElementById("makePostImageUploader").value = null; 
    } else {
      alert("Something went wrong, please try again.")
    }
    isPosting = false;
  } else {
    alert("Invalid post, dont spam!")
  }
}

async function updateFeed() {
  const response = await fetch("/getFeed", POST({ selectedFeed: selectedFeed, communityName: communityName}));
  const data = await response.json();
  if (data.failed) {
    //this means that the user isn't following anyone
    document.getElementById(
      "feed"
    ).innerHTML = `<div style='text-align: center; margin-top: 10px;'>Find some friends and communities to get started, or check out the "Trending" section</div>`;
  } else {
    allPostsArray = data.posts;
    //load the first 15 posts on the document.
    let postsHTMLstring = "";
    console.log("allPostsArray", allPostsArray);
    for (let i = 0; i < 15 && i < allPostsArray.length; i++) {
      postsHTMLstring += GetPostHTML(allPostsArray[i]);
    }
    document.getElementById("feed").innerHTML = postsHTMLstring;

    //add eventlistener that detects if you scrolled to the bottom of the page, if you have, he will load more posts.
    document
      .getElementById("mainArea")
      .addEventListener("scroll", onFeedScroll);
  }
}

function onFeedScroll() {
  //called when the user scrolls in the feed, will check if hes at the bottom, then load more posts.
  const distanceFromBottom = Math.abs(
    this.scrollTop + this.clientHeight - this.scrollHeight
  );

  if (distanceFromBottom < 150) {
    //user is approaching the bottom, now load more posts
    const currentPostCount = document.getElementById("feed").childNodes.length;
    let postsHTMLstring = "";
    for (
      let i = currentPostCount;
      i < currentPostCount + 15 && i < allPostsArray.length;
      i++
    ) {
      postsHTMLstring += GetPostHTML(allPostsArray[i]);
    }
    document.getElementById("feed").innerHTML += postsHTMLstring;
  }
}

function GetPostHTML(post) {
  let postImgHtml = "";
  const videoTypes = ["mp4"]
  for(let i = 0; i < post.images.length; i++) {
    const url = new URL(post.images[i])
    const extension = url.pathname.split(".")[1]
    //this should work for rendering videos, the problem is uploading videos...
    if (videoTypes.includes(extension)) {
      postImgHtml+=`<video class="aPostInTheFeedImg" controls><source src="${post.images[i]}"></video>`
    } else {
      postImgHtml+=`<img class="aPostInTheFeedImg" src="${post.images[i]}">`
    }
    //postImgHtml+=`<div class="aPostInTheFeedImg" style="background-image: url('${post.images[i]}');"></div>`
  }
  let communityTagHTML = ``;
  if (post.community != null) {
    communityTagHTML+=`<div class="aPostCommunityTag" onclick="window.location.href='/c/${post.community}'" style="background: ${ColorString(post.community)};">${post.community}</div>`
  }
  const postHTMLString = `<div class="aPostInTheFeed" id="postInTheFeed-${post.id}"><div class="aPostInTheFeedUserArea"><div class="aPostInTheFeedProfile"><img onclick="window.location.href='/p/${
        post.author_username
      }'" src="${
        post.pfp
      }" /><a class="aPostInTheFeedProfileName" href='/p/${
        post.author_username
      }'>${
        post.author_username
      }</a>${communityTagHTML}<div class="aPostInTheFeedDate">${post.timestamp}</div></div></div><div class="aPostInTheFeedHeaderArea">${
        post.header
      }</div><div class="aPostInTheFeedTextArea">${
        post.content
      }</div><div class="aPostInTheFeedImgArea">${postImgHtml}</div><div class="aPostInTheFeedButtonArea"><button onclick="interactPost(1, '${
        post.id
      }')"><img class="aPostInTheFeedButton" src="https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/like-${post.interactions.likes.toggled}.svg?v=1675622120936" /></button><div class="aPostInTheFeedCounter" id="like-${
        post.id
      }">${
        post.interactions.likes.count
      }</div><button onclick="interactPost(2, '${
        post.id
      }')"><img class="aPostInTheFeedButton" src="https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/dislike-${post.interactions.dislikes.toggled}.svg?v=1675622120936" /></button><div class="aPostInTheFeedCounter" id="dislike-${
        post.id
      }">${
        post.interactions.dislikes.count
      }</div><button onclick="window.location.href='/p/${post.author_username}/${
        post.id
      }'"><img class="aPostInTheFeedButton" src="https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/comment.svg?v=1675622120936" /></button><div class="aPostInTheFeedCounter" id="comment-${
        post.id
      }">${
        "x"
      }</div><button onclick="interactPost(3, '${
        post.id
      }')"><img class="aPostInTheFeedButton" src="https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/share.svg?v=1675622120936" /></button><div class="aPostInTheFeedCounter" id="share-${
        post.id
      }"></div></div></div>`
  return postHTMLString;
}

async function interactPost(interactionType, postID) {
  //interactionType translation:
  // 1 = like, 2 = dislike, 3 = share
  fetch("/interactPost", POST({interactionType: interactionType, postID: postID}));
  
  const liked = document.getElementById("postInTheFeed-" + postID).children[4].children[0].children[0].src === 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/like-1.svg?v=1675622120936';
  const disliked = document.getElementById("postInTheFeed-" + postID).children[4].children[2].children[0].src === 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/dislike-1.svg?v=1675622120936';
  const likeCounter = document.getElementById("postInTheFeed-" + postID).children[4].children[1];
  const dislikeCounter = document.getElementById("postInTheFeed-" + postID).children[4].children[3];
  //update the icons:
  if (interactionType === 1) {
    if (liked) {
      likeCounter.innerText = Number(likeCounter.innerText) - 1;
      document.getElementById("postInTheFeed-" + postID).children[4].children[0].children[0].src = 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/like-0.svg?v=1675622120936';
    } else {
      likeCounter.innerText = Number(likeCounter.innerText) + 1;
      document.getElementById("postInTheFeed-" + postID).children[4].children[0].children[0].src = 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/like-1.svg?v=1675622120936';
      if (disliked) dislikeCounter.innerText = Number(dislikeCounter.innerText) - 1;
      document.getElementById("postInTheFeed-" + postID).children[4].children[2].children[0].src = 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/dislike-0.svg?v=1675622120936';
    }
  } else if (interactionType === 2) {
    if (disliked) {
      dislikeCounter.innerText = Number(dislikeCounter.innerText) - 1;
      document.getElementById("postInTheFeed-" + postID).children[4].children[2].children[0].src = 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/dislike-0.svg?v=1675622120936';
    } else {
      dislikeCounter.innerText = Number(dislikeCounter.innerText) + 1;
      document.getElementById("postInTheFeed-" + postID).children[4].children[2].children[0].src = 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/dislike-1.svg?v=1675622120936';
      if (liked) likeCounter.innerText = Number(likeCounter.innerText) - 1;
      document.getElementById("postInTheFeed-" + postID).children[4].children[0].children[0].src = 'https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/like-0.svg?v=1675622120936';
    }
  }
}

async function followUser(username) {
  if (username === undefined) username = document.getElementById("searchForFriendsInput").value;
  const response = await fetch("/followUser", POST({userToFollow: username}))
  const result = await response.json();
  console.log(result.result);
  if (!result.userExists) {
    alert(`User "${username} not found"`);
  }
  else {
    alert(result.message);
    loadFriendsList();
  }
}

async function Search(query) {
  const response = await fetch("/search", POST({query: query, results: ["users", "communities"]}));
  const result = await response.json();
  return result.result
}

async function QuickSearch() {
  const query = document.getElementById("searchInput").value
  if (query == "") {
    document.getElementById("searchResultArea").innerHTML = "";
    return;
  } //dont search for empty queries
  const result = await Search(query);
  console.log(result);
  let resultHTML = "";
  for(let i = 0; i < Math.max(result.communities.length, result.users.length); i++) {
    if (i < result.users.length) {
      resultHTML+=`<div onclick="window.location.href='/p/${result.users[i].username}'" class="searchResult"><img class="aFriendInTheFriendsListPfp" src="${result.users[i].pfp}"><div class="resultName">${result.users[i].username}</div><button style="background: ${result.users[i].following === 1 ? "var(--accent-clr1)" : "var(--accent-clr)"}" onclick="followUser('${result.users[i].username}')" class="addFriendButton"><img src="https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/following-user${result.users[i].following}.svg?v=1676060396976"></button></div>`;
    }
    if (i < result.communities.length) {
      resultHTML+=`<div onclick="window.location.href='/c/${result.communities[i].name}'" class="searchResult"><div style="background: ${ColorString(result.communities[i].name)};" class="aCommunityPfp">${result.communities[i].name[0]}</div><div class="resultName">C-${result.communities[i].name}</div><button onclick="joinCommunity('${result.communities[i].name}')" style="background: ${result.communities[i].member === 1 ? "var(--accent-clr1)" : "var(--accent-clr)"}" class="addFriendButton"><img src="https://cdn.glitch.global/dcc9271c-71a4-4fc7-90e2-52d4f0d1d489/community-member${result.communities[i].member}.svg?v=1676061014923"></button></div>`;
    }
  }
  if (resultHTML == "") resultHTML = "No results"
  document.getElementById("searchResultArea").innerHTML = resultHTML;
}

function ColorString(string) {
  const x = string.charCodeAt(0);
  const y = string.charCodeAt(string.length - 1);
  const z = string.charCodeAt(Math.floor(string.length / 2));
  
  const letters = [String.fromCharCode(97 + (x % 6)), String.fromCharCode(97 + (y % 6)), String.fromCharCode(97 + (z % 6))]
  return `#` + letters[0] + (z % 6) + letters[1] + (y % 6) + letters[2] + (x % 6);
}



async function createCommunity() {
  const communityName = document.getElementById("createCommunityName").value;
  const communityLeader = document.getElementById("createCommunityLeader").value;
  const communityDesc = document.getElementById("createCommunityDesc").value;
  
  if (communityName == "" || communityName.length > 15 || communityName.toLowerCase() == "following" || communityName.toLowerCase() == "trending") {
    alert("Invalid Community Name, can't be more than 15 characters");
    return;
  }
  if (communityDesc.length > 160) {
    alert("Description can't be longer than 160 characters")
    return;
  }
  
  const response = await fetch("/createCommunity", POST({communityName: communityName, communityLeader: communityLeader, communityDesc: communityDesc}));
  const result = await response.json();
  if (result.failed) {
    alert(result.message);
  } else {
    alert(result.message);
    document.getElementById("createCommunityName").value = null;
    document.getElementById("createCommunityDesc").value = null;
    document.getElementById("createCommunityMenu").style = null;
    loadCommunities();
  }
}

async function joinCommunity(communityName) {
  const response = await fetch("/joinCommunity", POST({name: communityName}));
  const result = await response.json();
  console.log(result);
  alert(result.message);
  loadCommunities();
}

async function loadCommunities() {
  //retrieve all users communities
  let communitiesHTML = ``;
  const response = await fetch("/getUserCommunities");
  const result = await response.json();
  for(let i = 0; i < result.communities.length; i++) {
    communitiesHTML+=`<button class="aFriendInTheFriendsList" onclick="window.location.href = '/c/${result.communities[i]}'"><div style="background: ${ColorString(result.communities[i])};" class="aCommunityPfp">${result.communities[i][0]}</div>${result.communities[i]}</button>`
  }
  if (communitiesHTML.length == 0) communitiesHTML = "Join some Communities!"
  document.getElementById("communitiesListArea").innerHTML = communitiesHTML;
}

async function loadFriendsList() {
  const response = await fetch("/getUserFriends");
  const result = await response.json();
  let htmlString = ``;
  for(let i = 0; i < result.friends.length; i++) {
    //exclude yourself from rendering in the friendslist
    if (document.getElementById("sidebarMyProfileTextDiv").innerText != result.friends[i].username) htmlString+=`<div class="aFriendInTheFriendsList" onclick="window.location.href = '/p/${result.friends[i].username}'"><img class="aFriendInTheFriendsListPfp" src="${result.friends[i].pfp}"/><div class="aFriendInTheFriendsListNameArea">${result.friends[i].username}</div></div>`
  }
  if (htmlString.length == 0) htmlString = "Add your friends!"
  document.getElementById("sidebarFriendsArea").innerHTML = htmlString;
}

