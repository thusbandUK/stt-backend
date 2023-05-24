
//This is important, it takes a string of any length as input and outputs an array of strings, each with a max length of 1000 characters

module.exports.journalDivider = (stringToDivide) => {
    
    let arrayToReturn = [];
    let workingString;
    if (stringToDivide.length <= 1000){
        arrayToReturn.push(stringToDivide);
        return arrayToReturn;
    }
    let numberOfPages = Math.ceil(stringToDivide.length / 1000);
    
    let y;
    for (y = 0; y < numberOfPages; y++){
        const thousand = y*1000;
        arrayToReturn.push(stringToDivide.slice(thousand, (thousand+1000)));
    }

    //return arrayToReturn;
    return arrayToReturn;

}

//console.log(journalDivider('hello!').length);