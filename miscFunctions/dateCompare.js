const dateCompare = (storedDate, currentDate) => {
    storedTimeMilliseconds = storedDate.getTime();
    
    currentTimeMilliseconds = currentDate.getTime();
    

    const differenceInMilliseconds = currentTimeMilliseconds - storedTimeMilliseconds;
    
    const differenceInHours = differenceInMilliseconds / 3600000;
    
    if (differenceInHours > 100){
        return false;
    } else {
        return true;
    }
}

module.exports = { dateCompare };