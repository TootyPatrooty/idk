document.getElementById("newImgUploadInput").addEventListener("change", uploadImage);
function POST(data) {
  //takes the passed data and packages it into a json object that contains fetching options needed for sending data to the server
  const fetchOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
  return fetchOptions;
}

async function uploadImage() {
    console.log("uploading image");
    await fetch("https://api.imgur.com/3/image", {
    method: "post",
    headers: {
      Authorization: "Client-ID 24f8e7b40c984de"
    },
    body: document.getElementById("newImgUploadInput").files[0]
  }).then(data => data.json()).then(data => {
    updateProfilePicture(data.data.link)
  })
}

async function updateProfilePicture(newURL) {
  console.log("setting pfp as " + newURL);
  if (newURL == "" || newURL == null) return;
  const response = await fetch("/settings/pfp", POST({url: newURL}))
  const data = await response.json();
  document.getElementById("profilePicture").src = data.url;
  document.getElementById("newurlinput").value = null;
}