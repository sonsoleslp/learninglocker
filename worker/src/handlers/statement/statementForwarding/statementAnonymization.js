import { get, set } from 'lodash';

const crypto = require('crypto');
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

// Choose a hash function
const hashFunction = 'sha256';

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
    } catch(ep){
      console.error(ep);
    }
  });
  return xAPIStatement;
}



export default pseudonymizeXAPIStatement;