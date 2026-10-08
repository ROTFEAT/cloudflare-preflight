import Ajv from 'ajv';
import {asset,json} from './core.mjs';
const ajv=new Ajv({allErrors:true,strict:false});
for(const name of ['deployment-identity','policy','official-skills-lock','report','semantic-review','trust','approval'])ajv.addSchema({...json(asset(`${name}.schema.json`)),$id:`${name}.schema.json`});
export function validate(name,data) {const valid=ajv.getSchema(`${name}.schema.json`);if(!valid(data))throw new Error(`schema_invalid:${name}:${valid.errors.map(e=>`${e.instancePath}:${e.keyword}`).join(',')}`);return data;}
