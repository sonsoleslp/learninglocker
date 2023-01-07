import { get, set } from 'lodash';
const crypto = require('crypto');
// Choose a hash function
const hashFunction = 'sha256';


const fieldsToAnonymize = [
  'statement.actor.mbox', 
  'statement.actor.mbox_sha1sum', 
  'statement.actor.account.email', 
  'statement.actor.account.name', 
  'statement.actor.account.homePage', 
  'statement.actor.openid', 
  'statement.actor.name', 
  'statement.actor.member', 
  'agents', 
  'relatedAgents', 
  'registrations',
  //'person.display',
  'statement.context.registration'
];



const generatePseudonym = (personalInformation) => {
  // Hash the personal information using the chosen hash function
  const hash = crypto.createHash(hashFunction);
  hash.update(personalInformation);
  let result =  hash.digest('hex');
  if ((typeof personalInformation == "string") && !!(personalInformation.match("mailto"))) {
    result = "mailto:" + result + "@anonymous.org";
  }

  return result;
  
}



const pseudonymizeXAPIStatement = (xAPIStatement) => {
  fieldsToAnonymize.forEach(field => {
    try {
      const personalInformation = get(xAPIStatement, field);
      if (personalInformation) {
        if (personalInformation && Array.isArray(personalInformation)) {
          let pseudonym =  personalInformation.map(pi => {
            return generatePseudonym(pi);
          });
          set(xAPIStatement, field, pseudonym);
        } else {
          let pseudonym = generatePseudonym(personalInformation);
          set(xAPIStatement, field, pseudonym);
        }
      }
    } catch(pseudonym_error){
      logger.error("Error pseudonymizing:" ,pseudonym_error);
      return null;
    }
  });
  console.log(JSON.stringify(xAPIStatement, null, 4));

  return xAPIStatement;
}

export default pseudonymizeXAPIStatement;