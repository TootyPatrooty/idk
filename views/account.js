function POST(data) {
  //takes the passed data and packages it into a json object that contains fetching options needed for sending data to the server
  const fetchOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
  return fetchOptions;
}

function StatusMessage(message) {
  alert(message);
}

async function AttemptRegister() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  if (username.length > 15) {
    StatusMessage("Username can't be longer than 15 characters");
    return;
  }
  if (password.length > 50) {
    StatusMessage("Password can't be longer than 50 characters")
  }
  const response = await fetch(
    "/registerUser",
    POST({
      username: username,
      password: password,
    })
  );
  const result = await response.json();
  
  result.failed ? result.usrTaken ? StatusMessage("username is taken") : StatusMessage("invalid password") : window.location.replace("/");
}

async function AttemptLogin() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  
  const response = await fetch(
    "/loginUser",
    POST({ username: username, password: password })
  ); //send credentials to server
  const data = await response.json();
  
  data.failed ? StatusMessage("Invalid Credentials") : window.location.replace("/");
}