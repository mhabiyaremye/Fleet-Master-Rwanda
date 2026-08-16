const firstnameInput=document.getElementById("first-name");
const lastnameInput=document.getElementById("last-name");
const employeeidInput=document.getElementById("employee-id");
const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const passwordconfirmInput=document.getElementById("confirm-password");
const registerButton=document.getElementById("submit-button");

registerButton.addEventListener("click",function(event){
let firstname=firstnameInput.value;
let lastname=lastnameInput.value;
let employeeId=employeeidInput.value;
let email=emailInput.value;
let password=passwordInput.value;
let confirmPassword=passwordconfirmInput.value;
let genderInput = document.querySelector('input[name="gender"]:checked');

if(!firstname){
    console.log("Enter your First name  ");    
    return;
}
if(!lastname){
    console.log("Enter your Last name");
    return;
}
if(!employeeId){
    console.log("Enter your EmployeeID")
    return;
}
if(!genderInput){
    console.log("select gender");
    return;
}
let gender = genderInput.value;

if(!email){
    console.log("Enter Your Email");
    return;
}
if(!password){
    console.log("Enter your password");
    return;
}
if(password.length<12){
    console.log("Password must have at least 12 characters");
    return;
}
if(confirmPassword !== password){
    console.log("Re-type Your password");
    return;
}
console.log("user added waiting for approval from the admin");

fetch("http://localhost:3000/register",{
    method:"post",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
        firstname,
        lastname,
        employeeId,
        gender,
        email,
        password

    })
})
.then(function(response){
    return response.json();
})
.then(function(data){
    alert(data.message);
})

})






