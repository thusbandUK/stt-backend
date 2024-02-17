const dateCompare = (storedDate, currentDate) => {
    storedTimeMilliseconds = storedDate.getTime();
    //console.log(storedTimeMilliseconds);
    currentTimeMilliseconds = currentDate.getTime();
    //console.log(currentTimeMilliseconds);

    const differenceInMilliseconds = currentTimeMilliseconds - storedTimeMilliseconds;
    //console.log(differenceInMilliseconds);
    const differenceInHours = differenceInMilliseconds / 3600000;
    //console.log(differenceInHours);
    if (differenceInHours > 0.2){
        //console.log('returned false');
        return false;
    } else {
        //console.log('returned true');
        return true;
    }
}

module.exports = { dateCompare };