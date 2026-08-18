


let firstnameInput = document.getElementById("first-name");
let lastnameInput=document.getElementById("last-name");
let employeeIdinput = document.getElementById("employee-id")
let emailInput = document.getElementById("email");
let passwordInput = document.getElementById("password");
let setupCodeInput = document.getElementById("set-up-code");
let setupAdminForm = document.getElementById("set-up-admin-form");

setupAdminForm.addEventListener("submit",function(event){
event.preventDefault();
let firstname = firstnameInput.value;
let lastname = lastnameInput.value;
let employeeId = employeeIdinput.value;
let email = emailInput.value;
let password = passwordInput.value;
let setupCode = setupCodeInput.value;
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
if(!setupCode){
    console.log("Provide setupcode");
    return;
}

fetch("http://localhost:3000/setupadmin",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
        firstname,
        lastname,
        employeeId,
        gender,
        email,
        password,
        setupCode
    })
})
.then(function(response){
    return response.json();
})
.then(function(data){
    alert(data.message);
})
.catch(function(error){
    alert(error);
    
})
})



