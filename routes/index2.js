router.post('/save-journal', async function(req, res, next) {
    //generates client to connect to database
    const client = await pool.connect()
    
    //harvests journal title and id from req.body object
    const { title, journalId } = req.body;
    
    //transforms journal entry into an array of strings each of no more than 1000 characters in length
    const processedEntry = journalDivider.journalDivider(req.body.journalEntry);
    //determines the number of sections in which the entry will be saved
    const numberOfSections = processedEntry.length;
    
  
    //defines database query for insertion into the journal_sections table
    const journalSectionEntry = 'INSERT INTO journal_sections(journal_reference_id, section_number) VALUES($1, $2) RETURNING *'
    //defines database query for insertion into the journal_content table
    const journalContentEntry = 'INSERT INTO journal_content(journal_section_id, content) VALUES($1, $2) RETURNING *'
  
    try {
      //initiates a transaction, so that if there is an error at any stage, the whole set of database changes will be rolled back
      await client.query('BEGIN')
     
      //makes entries for each section of the entry into the journal_sections table; harvests the id for each section
      let x;
      let arrayOfSectionResponses = [];
      for (x = 0; x<numberOfSections; x++){
        const journalSectionValues = [journalId, x+1]
        const dbResponse = await client.query(journalSectionEntry, journalSectionValues)
        arrayOfSectionResponses.push(dbResponse.rows[0]);
      }
  
      //makes entries for each section of the journal entry into the journal_content table, using the journal_section_id values from 
      //code directly above
      let y;
      let arrayOfContentResponses = [];
      for (y = 0; y<numberOfSections; y++){
        const journalContentValues = [arrayOfSectionResponses[y].id, processedEntry[y]]
        const dbResponse = await client.query(journalContentEntry, journalContentValues)
        arrayOfContentResponses.push(dbResponse.rows[0]);
      }
      //Commits all the changes, provided no errors have occurred
      await client.query('COMMIT')
  
      //harvests data about the result of the database queries, which can be used to check the number of sections in which it was saved
      //(ie of more use to developer than client)
      finalisedNumberOfSections = arrayOfSectionResponses.pop();
      finalisedContent = arrayOfContentResponses.pop();
      
      return res.status(200).json({ message: `Journal saved with ${finalisedNumberOfSections.section_number} sections and ${finalisedContent.id}`});
    } catch (e) {
      await client.query('ROLLBACK')
      return res.status(500).json({message: `There was some kind of error`});
      
    } finally {
      //releases client from pool
      client.release()
    }  
  
  });