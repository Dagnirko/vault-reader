import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import util = require("./util.js");
import helper = require("./vault-helper.js")

async function run() {
    try{
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //Get User/Password from serviceEndpoint:Generic
        var input_serviceDetails = tl.getInput('vaultService', true);
        if(typeof input_serviceDetails == 'undefined'){
            tl.setResult(tl.TaskResult.Failed, tl.loc("ServiceNotExist"));
            return
        }

        let serviceEndpoint: tl.EndpointAuthorization = tl.getEndpointAuthorization(input_serviceDetails, true);
        let base_url = tl.getEndpointUrl(input_serviceDetails, true);
        let loginType: string = serviceEndpoint.parameters['AuthMethods'];
        let vaultUser: string = serviceEndpoint.parameters['Username'];
        let vaultPass: string = serviceEndpoint.parameters['Password'];
        let disableStrictSSL: boolean =  serviceEndpoint.parameters['DisableStrictSSL'].toLowerCase() == 'true'  ;
        let verifyCertificate = !disableStrictSSL
        try{
            tl.debug(tl.loc('ConnectionDetailsDebug', base_url, loginType))

            const token: string = (loginType == "token") ? vaultPass : await util.getVaultToken(base_url, loginType, vaultUser, vaultPass, verifyCertificate);
            let array: string[]
            var var_list: {[index: string]: string;} = {}; // create an empty dictionary
            const input_sourceType = tl.getInput("sourceType")
            if(input_sourceType == "inline"){
                var input_data: string = tl.getInput('data', true) || '';
                array = input_data.split(/\r\n|\r|\n/);
                handle(base_url, token, "full", array, var_list, verifyCertificate)
            }
            else if(input_sourceType == "filePath"){
                var input_variable: string = tl.getInput('variableData', true) || '';
                let var_array = input_variable.split(/\r\n|\r|\n/);
                handle(base_url, token, "variable", var_array, var_list, verifyCertificate)

                var input_filePath: string = tl.getPathInput("filePath", true) || '';
                array = util.readFile(input_filePath).split('\n')
                handle(base_url, token, "full", array, var_list, verifyCertificate)
            }
            else{
                tl.setResult(tl.TaskResult.Failed, "sourceType not valid - " + input_sourceType);
                return
            }
        }
        catch(error){
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, tl.loc("tokenFail"));
        }
    }
    catch(error){
        tl.setResult(tl.TaskResult.Failed, error.message || 'run() failed', true);
    }
}

async function handle(base_url: string, token: string, type: string, array: string[], var_list: {[index: string]: string}, verifyCertificate: boolean){
    for (var i = 0; i < array.length; i++) {
		let index = i + 1
		let line: string = array[i].trim();

        if(helper.isIgnoredLine(line) || 
            helper.massageLineHandling(line))
            continue;
        
        if(helper.variableLineHandling(line, var_list)){
            continue
        }
        else if(type == "full" && await helper.actionLineHandling(index, line, var_list, base_url, token, verifyCertificate)){
            continue
        }
        else{
            tl.setResult(tl.TaskResult.Failed, tl.loc("unknownLineFormat", index));            
        }
	}
}

run();
