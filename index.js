
let loginButton=document.getElementById("log-in-button");
let inputEmail=document.getElementById("email");
let inputPassword=document.getElementById("password");
let emailError=document.getElementById("email-error");
let passwordError=document.getElementById("password-error");
let successDialog = document.getElementById("success-dialog-content");
let continueButton=document.getElementById("continue-button");
continueButton.addEventListener("click",function(){
    window.location.href="../dashboard/dashboard.html";

});
loginButton.addEventListener("click", function () {
let emailValue=inputEmail.value;
let passwordValue=inputPassword.value;

 if(emailValue ===""){
    emailError.textContent="! Please enter email";
        // console.log("please enter email");
         return
    }

else if (!emailValue.includes("@")){
    emailError.textContent="! Please enter a valid email";
   // console.log("please enter a valid email");
    return;
    
}
else{
   emailError.textContent="";
}
if(passwordValue===""){
    passwordError.textContent="! Please enter password";
    //console.log("please enter password")
    return
}
else if(passwordValue.length<8){
    passwordError.textContent="! Please enter a valid password";
    //console.log("please enter a valid password");
    //console.log(passwordError);
    return
}
else{
    //console.log(passwordValue);
     passwordError.textContent="";
}
   //console.log("both email and password are correct ");
 //  successDialog.style.display="block";

 fetch("http://localhost:3000/login",{
    method:"Post",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
        email:emailValue,
        password:passwordValue
    })
 })
.then(function(response){
    return response.json();
})
.then(function(data){
    if(data.success === false){
        alert(data.message);
    }
    alert(data.message);
})

})











