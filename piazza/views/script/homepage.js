var schoolNamePassedInForm = getHiddenInputInForm('schoolName', schoolName)
var usernamePassedInForm = getHiddenInputInForm('username', username)
var hashedPublicKeyPassedInForm = getHiddenInputInForm('hashedPublicKey', hashedPublicKey)
var classNumberPassedInForm = getHiddenInputInForm('classNumber', classNumber)
var termPassedInForm = getHiddenInputInForm('term', term)
var classNamePassedInForm = getHiddenInputInForm('className', className)
var rolePassedInForm = getHiddenInputInForm('role', role)

var allHiddenParametersInForm = schoolNamePassedInForm + usernamePassedInForm + hashedPublicKeyPassedInForm
                                 + classNumberPassedInForm + termPassedInForm + classNamePassedInForm
                                 + rolePassedInForm

var newPostForm = "<form id='newPostForm' action='http://localhost:3000/newPost' method='post'>" 
                    + allHiddenParametersInForm +
                    "<table>" +
                        "<tr>" +
                            "<th>Post Type</th>" +
                            "<td>" +
                                "<input type='radio' name='postType' value='question'>Question &nbsp &nbsp" +
                                "<input type='radio' name='postType' value='note'>Note &nbsp &nbsp" +
                                "<input type='radio' name='postType' value='poll'>Poll/In-Class Response" +
                            "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<th>Post to</th>" +
                            "<td>" +
                                "<input type='radio' name='postTo' value='everyone'>Entire Class &nbsp" +
                                "<input type='radio' name='postTo' value='instructors'>Instructors" +
                            "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<th>Select Tag(s)</th>" +
                            "<td>" +
                                "<input type='checkbox' name='tags' value='hw1'>hw1" +
                                "<input type='checkbox' name='tags' value='hw2'>hw2" +
                                "<input type='checkbox' name='tags' value='hw3'>hw3" +
                                "<input type='checkbox' name='tags' value='hw4'>hw4" +
                                "<input type='checkbox' name='tags' value='hw5'>hw5" +
                                "<input type='checkbox' name='tags' value='hw6'>hw6" +
                                "<input type='checkbox' name='tags' value='hw7'>hw7" +
                                "<input type='checkbox' name='tags' value='hw8'>hw8" +
                                "<input type='checkbox' name='tags' value='hw9'>hw9" +
                                "<input type='checkbox' name='tags' value='hw10'>hw10" +
                                "<input type='checkbox' name='tags' value='extra'>extra" +
                                "<input type='checkbox' name='tags' value='midterm'>midterm" +
                                "<input type='checkbox' name='tags' value='final'>final" +
                            "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<th>Summary</th>" +
                            "<td>" +
                                "<input type='text' name='summary' value='' placeholder='Enter a one line summary....'>" +
                            "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<th id='postDetails'>Details</th>" +
                            "<td>" +
                                "<textarea rows='20' cols='50' name='postContent'></textarea>" +
                            "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<th>Show my name as </th>" +
                            "<td>" +
                                "<select name='showMyNameAs'>" +
                                    "<option value='username'>" + username + "</option>" +
                                    "<option value='AnonymousToClassmates'>Anonymous to Classmates</option>" +
                                    "<option value='AnonymousToEveryone'>Anonymous to Everyone</option>"+
                                "</select>" +
                            "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<th></th>" +
                            "<td>" +
                                "<input type='submit' name='post' value='Post My Question'>" +
                            "</td>" +
                        "</tr>" +
                    "</table>" +
                "</form>"

// var oneSummary = "<p class='oneSummary'>
//                     <span class='summaryTitle'>
//                         The best way to get answers
//                     </span >
//                     <span class='summaryDate'>
//                         12/16/2017
//                     </span><br>
//                     <span class='summaryContent'>
//                     Ask questions on Piazza rather than 
//                     emailing your teaching staff 
//                     so everyone can benefit from th
//                     e response (and so you c
//                         an get answers from classmates who are up as late as you are).
//                     </span>
//                     <img src='views/photos/note.jpg'>
//                     </img>
//                     </p>"


function getHiddenInputInForm(name, value) {
    return "<input type='hidden' name='" + name + "' value='" + value + "'>"
}

function newPost() {
    document.getElementById("postContent").innerHTML = newPostForm
}

function setValues() {
    document.getElementById("title").innerHTML = classNumber
    document.getElementById("account").innerHTML = username
    document.getElementById("class").innerHTML = classNumber
}

function renderPostsSummary() {

}

function start() {
    setValues()
    renderPostsSummary()
}

window.onload = start