import tl = require('azure-pipelines-task-lib/task');
import util = require("./util.js");
import path = require('path');
import { Guid } from "guid-typescript";

export function actionVar(path_detailes: any, field: string, index: number, type: string, var_name: string) {
    if (path_detailes[field])
        tl.setVariable(var_name, String(path_detailes[field]), true);

    else
        tl.setResult(tl.TaskResult.Failed, tl.loc("fieldNotExist", index, field, type));
}

export function actionPre(path_detailes: any, field: string, index: number, type: string, var_name: string) {
    if (field == "*") {
        util.createVariableFromObject(path_detailes, -2, var_name);
        tl.warning(tl.loc("actionPreWarning", index));
    }
    else {
        let fields = field.split(',');

        fields.forEach(function (value) {
            value = value.trim();
            if (!path_detailes[value]) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("fieldNotExist", index, value, type));
            }
            else{
                tl.setVariable(var_name + "_" + value, String(path_detailes[value]), true);
            }
        });
    }
}

export function actionRaw(path_detailes: any, field: string, index: number, type: string, var_name: string) {
    if (!path_detailes[field]) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("fieldNotExist", index, field, type));
        return
    }

    let filename: string = path.join(tl.getVariable('agent.tempDirectory') || '', var_name + "-" + Guid.create());

    try {
        util.writeToFile(filename, path_detailes[field]);
        if (tl.getPlatform() != tl.Platform.Windows)
            tl.execSync('chmod', '400 ' + filename);

        tl.setVariable(var_name, filename, false);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("writeFieldToFileFail", index, type));
    }
}

export function actionBase64(path_detailes: any, field: string, index: number, type: string, var_name: string) {
    if (!path_detailes[field]) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("fieldNotExist", index, field, type));
        return;
    }

    let filename: string = path.join(tl.getVariable('agent.tempDirectory') || '', var_name + "-" + Guid.create());

    try {
        let value = Buffer.from(path_detailes[field], 'base64');
        util.writeToFile(filename, value);
        if (tl.getPlatform() != tl.Platform.Windows)
            tl.execSync('chmod', '400 ' + filename);
        //write field to file
        tl.setVariable(var_name, filename, false);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("writeFieldToFileFail", index, type));
    }
}

export function actionJson(path_detailes: any, field: string, index: number, type: string, var_name: string, var_list: {[index: string]: string;}) {
    if (!path_detailes) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("dataNotExist", index, field, type));
        return;
    }

    if (field != '*') {
        let isOK = util.compareObjectSchemeToFile(path_detailes, field, index);
        if(!isOK)
            return;
    }
    else {
        tl.warning(tl.loc("skipCompareObject", index, type));
    }

    let filename: string = path.join(tl.getVariable('agent.tempDirectory') || '', var_name + "-" + Guid.create());

    try {
        util.writeToFile(filename, JSON.stringify(path_detailes, null, 2));
        tl.setVariable(var_name, filename, false);
        util.addVariable(var_list, "{{" + var_name + "}}", filename)
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("writeFieldToFileFail", index, type));
    }
}

export function actionYaml(path_detailes: any, field: string, index: number, type: string, var_name: string, var_list: {[index: string]: string;}) {
    if (!path_detailes) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("dataNotExist", index, field, type));
        return;
    }

    if (field != '*') {
        let isOK = util.compareObjectSchemeToFile(path_detailes, field, index);
        if(!isOK)
            return;
    }
    else {
        tl.warning(tl.loc("skipCompareObject", index, type));
    }

    let filename: string = path.join(tl.getVariable('agent.tempDirectory') || '', var_name + "-" + Guid.create());

    try {
        const YAML = require ('yaml');
        let json = JSON.parse(JSON.stringify(path_detailes, null, 2))

        let doc = new YAML.Document()
        doc.contents = json

        util.writeToFile(filename, doc.toString());
        tl.setVariable(var_name, filename, false);
        util.addVariable(var_list, "{{" + var_name + "}}", filename)
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("writeFieldToFileFail", index, type));
    }
}

export function actionReplace(path_detailes: any, field: string, index: number, type: string, var_name: string, var_list: {[index: string]: string;}) {
    if (!path_detailes) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("dataNotExist", index, field, type));
        return;
    }

    let content = util.replaceAction(path_detailes, field, index);
    if (content == undefined) {
        return;
    }

    let filename: string = path.join(tl.getVariable('agent.tempDirectory') || '', var_name + "-" + Guid.create());

    try {
        util.writeToFile(filename, content);
        tl.setVariable(var_name, filename, false);
        util.addVariable(var_list, "{{" + var_name + "}}", filename)
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("writeFieldToFileFail", index, type));
    }
}

export function actionExport(path_detailes: any, field: string, index: number, type: string, var_name: string) {
    if (!path_detailes) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("dataNotExist", index, field, type));
        return;
    }

    let lineFormat = Buffer.from(field, 'base64').toString();
    let contentArr = util.exportAction(path_detailes, index, lineFormat)
    if (contentArr == undefined) {
        return;
    }

    let filename: string = path.join(tl.getVariable('agent.tempDirectory') || '', var_name + "-" + Guid.create());

    try {
        let fileContent = contentArr.join("\n") + "\n"
        util.writeToFile(filename, fileContent);
        tl.setVariable(var_name, filename, false);
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("writeFieldToFileFail", index, type));
    }
}
