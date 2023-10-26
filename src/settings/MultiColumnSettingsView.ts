import { App, ButtonComponent, Modal, Notice, Platform, PluginSettingTab, Setting } from "obsidian";
import MultiColumnMarkdown from "src/main";
import * as multiColumnParser from '../utilities/textParser';
import { getUID } from "src/utilities/utils";

export default class MultiColumnSettingsView extends PluginSettingTab {

    constructor(app: App, public plugin: MultiColumnMarkdown) {
        super(app, plugin);
    }
    
    display() {
        this.containerEl.empty();
        this.containerEl.createEl("h2", { text: "Multi-Column Markdown - Settings" });

        const settingsContainerEl = this.containerEl.createDiv();

        new Setting(settingsContainerEl)
            .setName("Number of Auto-Layout balance iterations.")
            .setDesc("The maximum number of times Auto-Layout will try to balance elements between all of the columns. This may cause Obsidian to slow during file load if this is set too high.")
            .addSlider((slider) => {
                slider.setLimits(1, 9, 2)
                slider.setValue(this.plugin.settings.autoLayoutBalanceIterations)
                slider.setDynamicTooltip()
                slider.onChange((val) => {
                    this.plugin.settings.autoLayoutBalanceIterations = val;
                    this.plugin.settingsUpdated()
                })
            })

        if(Platform.isMobile === true) {
            new Setting(settingsContainerEl)
                .setName("Render Column Regions on Mobile Devices")
                .addToggle((t) =>
                    t.setValue(this.plugin.settings.renderOnMobile).onChange((v) => {
                        this.plugin.settings.renderOnMobile = v
                        this.plugin.saveSettings()
                    }
                ));
        }

        this.containerEl.createEl("h5", { attr: {"style": "color: var(--text-error); margin-bottom: 0px;"}, text: "DANGER ZONE" });
        this.containerEl.createEl("hr", { attr: {"style": "margin-top: 1px; margin-bottom: 0.75em;"} })
        const dangerZoneContainerEl = this.containerEl.createDiv();

        this.buildUpdateDepreciated(dangerZoneContainerEl);
        this.buildFixMissingIDs(dangerZoneContainerEl);
    }

    private buildUpdateDepreciated(dangerZoneContainerEl: HTMLDivElement) {

        let docFrag = new DocumentFragment();
        docFrag.createDiv({}, div => {
            div.createSpan({}, span => {
                span.innerText = "This may take a while for large vaults.";
            });
            div.createEl("h6", {}, span => {
                span.setAttr("style", "color: var(--text-error); margin-bottom: 0px; margin-top: 3px;");
                span.innerText = "WARNING:";
            });
            div.createSpan({}, span => {
                span.setAttr("style", "color: var(--text-error);");
                span.innerText = "This action modifies all relavent notes and may lead to corrupted text.";
            });
            div.createEl("br");
            div.createSpan({}, span => {
                span.setAttr("style", "color: var(--text-error);");
                span.innerText = "No guarentee is given. Please make sure to back your vault up first.";
            });
        });
        let modalDescriptionEl = createDiv({}, div => {
            div.createSpan({ text: "This action may corrupt vault data." });
            div.createEl("br");
            div.createSpan({ text: "Please confirm you have backed up your vault." });
        });
        new Setting(dangerZoneContainerEl)
            .setName("Update ALL depreciated Multi-Column syntax.")
            .setDesc(docFrag)
            .addButton((b) => b.setButtonText("Update Syntax").onClick(() => {
                const modal = ConfirmModal.confirmModalWithElement(this.app, modalDescriptionEl, { primary: "Confirm", secondary: "Cancel" });
                modal.onClose = () => {
                    if (modal.confirmed === false) {
                        return;
                    }

                    updateFileSyntax();
                };
                modal.open();
            })
            );
    }

    private buildFixMissingIDs(dangerZoneContainerEl: HTMLDivElement) {
        
        let docFrag = new DocumentFragment();
        docFrag.createDiv({}, div => {
            div.createSpan({}, span => {
                span.innerText = "This will only modify regions without an already defined ID. This may take a while for large vaults.";
            });
            div.createEl("h6", {}, span => {
                span.setAttr("style", "color: var(--text-error); margin-bottom: 0px; margin-top: 3px;");
                span.innerText = "WARNING:";
            });
            div.createSpan({}, span => {
                span.setAttr("style", "color: var(--text-error);");
                span.innerText = "This action modifies all relavent notes and may lead to corrupted text.";
            });
            div.createEl("br");
            div.createSpan({}, span => {
                span.setAttr("style", "color: var(--text-error);");
                span.innerText = "No guarentee is given. Please make sure to back your vault up first.";
            });
        });
        let modalDescriptionEl = createDiv({}, div => {
            div.createSpan({ text: "This action may corrupt vault data." });
            div.createEl("br");
            div.createSpan({ text: "Please confirm you have backed up your vault." });
        });
        new Setting(dangerZoneContainerEl)
            .setName("Add random IDs to all Multi-Column regions.")
            .setDesc(docFrag)
            .addButton((b) => b.setButtonText("Add IDs").onClick(() => {
                const modal = ConfirmModal.confirmModalWithElement(this.app, modalDescriptionEl, { primary: "Confirm", secondary: "Cancel" });
                modal.onClose = () => {
                    if (modal.confirmed === false) {
                        return;
                    }

                    findAndReplaceMissingIDs();
                };
                modal.open();
            })
            );
    }
}

export class ConfirmModal extends Modal {

    static confirmModalWithText(app: App,
                                text: string,
                                buttons: { primary: string; secondary: string }): ConfirmModal {

        return new ConfirmModal(app, createSpan({text: text}), buttons)
    }

    static confirmModalWithElement(app: App,
                                   descriptionEl: HTMLElement,
                                   buttons: { primary: string; secondary: string }): ConfirmModal {
        return new ConfirmModal(app, descriptionEl, buttons)
    }

    public descriptionEl: HTMLElement
    public buttons: { primary: string; secondary: string }
    private constructor(app: App, 
                        descriptionEl: HTMLElement,
                        buttons: { primary: string; secondary: string }) {
        super(app);
        this.descriptionEl = descriptionEl;
        this.buttons = buttons;
    }
    confirmed: boolean = false;
    async display() {
        this.contentEl.empty();
        this.contentEl.appendChild(this.descriptionEl)

        const buttonEl = this.contentEl.createDiv();
        new ButtonComponent(buttonEl)
            .setButtonText(this.buttons.primary)
            .setCta()
            .onClick(() => {
                this.confirmed = true;
                this.close();
            });
        new ButtonComponent(buttonEl)
            .setButtonText(this.buttons.secondary)
            .onClick(() => {
                this.close();
            });
    }
    onOpen() {
        this.display();
    }
}

async function findAndReplaceMissingIDs() {

    function searchFileForMissingID(docText: string): { updatedFileContent: string,
                                                        numRegionsUpdated: number } {
        let lines = docText.split("\n");

        /**
         * Loop through all of the lines checking if the line is a 
         * start tag and if so is it missing an ID.
         */
        let linesWithoutIDs = 0
        for(let i = 0; i < lines.length; i++) {

            let data = multiColumnParser.isStartTagWithID(lines[i]);
            if(data.isStartTag === true && data.hasKey === false) {

                let originalText = lines[i]
                let text = originalText;
                text = text.trimEnd();
                if(text.charAt(text.length - 1) === ":") {
                    text = text.slice(0, text.length-1);
                }
                text = `${text}: ID_${getUID(4)}`;

                lines[i] = text;
                linesWithoutIDs++;
            }
        }                    

        if(linesWithoutIDs === 0) {
            return {
                updatedFileContent: docText,
                numRegionsUpdated: 0
            };
        }

        let newFileContent = lines.join("\n");
        return {
            updatedFileContent: newFileContent,
            numRegionsUpdated: linesWithoutIDs
        };
    }

    let count = 0;
    let fileCount = 0;
    for(let mdFile of app.vault.getMarkdownFiles()) {
        let originalFileContent = await app.vault.read(mdFile);

        let result = searchFileForMissingID(originalFileContent);
        if(result.numRegionsUpdated > 0) {
            count += result.numRegionsUpdated;
            fileCount++;

            let updatedFileContent = result.updatedFileContent;
            if(updatedFileContent !== originalFileContent) {
                app.vault.modify(mdFile, updatedFileContent);
            }
            else {
                console.log("No changes, not updating file.");
            }
        }
    }
    new Notice(`Finished updating:\n${count} region IDs, across ${fileCount} files.`)
}

async function updateFileSyntax() {
    
    let fileCount = 0
    let regionStartCount = 0;
    let columnBreakCount = 0;
    let columnEndCount = 0;
    for(let mdFile of app.vault.getMarkdownFiles()) {
        let originalFileContent = await app.vault.read(mdFile);

        let fileUpdated = false;
        let { updatedFileContent, numRegionsUpdated } = updateColumnCodeblockStartSyntax(originalFileContent);
        if(numRegionsUpdated > 0) {
            fileCount++;
            fileUpdated = true;
            regionStartCount += numRegionsUpdated
        }

        let colStart = updateColumnStartSyntax(updatedFileContent)
        if(colStart.numRegionsUpdated) {
            if(fileUpdated === false) {
                fileUpdated = true;
                fileCount++;
            }
            updatedFileContent = colStart.updatedFileContent
            regionStartCount += colStart.numRegionsUpdated
        }

        let colBreak = updateColumnBreakSyntax(updatedFileContent)
        if(colBreak.numRegionsUpdated) {
            if(fileUpdated === false) {
                fileUpdated = true;
                fileCount++;
            }
            updatedFileContent = colBreak.updatedFileContent
            columnBreakCount += colBreak.numRegionsUpdated
        }

        let colEnd = updateColumnEndSyntax(updatedFileContent)
        if(colEnd.numRegionsUpdated) {
            if(fileUpdated === false) {
                fileUpdated = true;
                fileCount++;
            }
            updatedFileContent = colEnd.updatedFileContent
            columnEndCount += colEnd.numRegionsUpdated;   
        }

        // TODO: Add in final file modification when done testing.
        if(updatedFileContent !== originalFileContent) {
            app.vault.modify(mdFile, updatedFileContent)
        }
        else {
            console.debug("No changes, not updating file.")
        }
    }

    new Notice(`Finished updating:\n${regionStartCount} start syntaxes,\n${columnBreakCount} column breaks, and\n${columnEndCount} column end tags,\nacross ${fileCount} files.`)
}

const OLD_COL_END_SYNTAX_REGEX = /=== *(end-multi-column|multi-column-end)/g
function updateColumnEndSyntax(originalFileContent: string): { updatedFileContent: string,
                                                                 numRegionsUpdated: number } {
    let matches = Array.from(originalFileContent.matchAll(OLD_COL_END_SYNTAX_REGEX))

    let updatedFileContent = originalFileContent;
    let offset = 0;
    
    for(let match of matches) {    
        let startIndex = match.index + offset
        let matchLength = match[0].length
        let endIndex = startIndex + matchLength;

        let columnEndSyntax = match[1]        
        let replacementText = `--- ${columnEndSyntax}`
        offset += replacementText.length - matchLength

        updatedFileContent = updatedFileContent.slice(0, startIndex) + replacementText + updatedFileContent.slice(endIndex)
        console.groupCollapsed()
        console.log("Original File:\n\n", originalFileContent)
        console.log("Updated File:\n\n", updatedFileContent)
        console.groupEnd()      
    }
    return {
        updatedFileContent: updatedFileContent,
        numRegionsUpdated: matches.length
    }                                           
}

const OLD_COL_BREAK_SYNTAX_REGEX = /===\s*?(column-end|end-column|column-break|break-column)\s*?===\s*?/g
function updateColumnBreakSyntax(originalFileContent: string): { updatedFileContent: string,
                                                                 numRegionsUpdated: number } {
    let matches = Array.from(originalFileContent.matchAll(OLD_COL_BREAK_SYNTAX_REGEX))

    let updatedFileContent = originalFileContent;
    let offset = 0;
    
    for(let match of matches) {    
        let startIndex = match.index + offset
        let matchLength = match[0].length
        let endIndex = startIndex + matchLength;

        let columnBreakSyntax = match[1]        
        let replacementText = `--- ${columnBreakSyntax} ---`
        offset += replacementText.length - matchLength

        updatedFileContent = updatedFileContent.slice(0, startIndex) + replacementText + updatedFileContent.slice(endIndex)
        console.groupCollapsed()
        console.log("Original File:\n\n", originalFileContent)
        console.log("Updated File:\n\n", updatedFileContent)
        console.groupEnd()      
    }
    return {
        updatedFileContent: updatedFileContent,
        numRegionsUpdated: matches.length
    }                                           
}

const OLD_COL_START_SYNTAX_REGEX = /=== *(start-multi-column|multi-column-start)/g
function updateColumnStartSyntax(originalFileContent: string): { updatedFileContent: string,
                                                                 numRegionsUpdated: number } {
    let matches = Array.from(originalFileContent.matchAll(OLD_COL_START_SYNTAX_REGEX))

    let updatedFileContent = originalFileContent;
    let offset = 0;
    
    for(let match of matches) {    
        let startIndex = match.index + offset
        let matchLength = match[0].length
        let endIndex = startIndex + matchLength;

        let columnStartSyntax = match[1]        
        let replacementText = `--- ${columnStartSyntax}`
        offset += replacementText.length - matchLength

        updatedFileContent = updatedFileContent.slice(0, startIndex) + replacementText + updatedFileContent.slice(endIndex)
        console.groupCollapsed()
        console.log("Original File:\n\n", originalFileContent)
        console.log("Updated File:\n\n", updatedFileContent)
        console.groupEnd()      
    }
    return {
        updatedFileContent: updatedFileContent,
        numRegionsUpdated: matches.length
    }                                           
}

const OLD_CODEBLOCK_COL_START_SYNTAX_REGEX = /```(start-multi-column|multi-column-start).*?```/sg;
function updateColumnCodeblockStartSyntax(originalFileContent: string): { updatedFileContent: string,
                                                                 numRegionsUpdated: number } {
    let matches = Array.from(originalFileContent.matchAll(OLD_CODEBLOCK_COL_START_SYNTAX_REGEX))

    let updatedFileContent = originalFileContent;
    let offset = 0;
    
    for(let match of matches) {

        let startIndex = match.index + offset
        let matchLength = match[0].length
        let endIndex = startIndex + matchLength;

        let originalSettingsText = match[0]
        let settingsText = originalSettingsText
        let columnStartSyntax = match[1]
        let columnStartLine = `--- ${columnStartSyntax}`

        
        let idResult = /ID:(.*)/i.exec(originalSettingsText)
        if(idResult !== null) {
            let id = idResult[1].trim()
            columnStartLine = `${columnStartLine}: ${id}`

            let startIndex = idResult.index
            let endIndex = startIndex + idResult[0].length

            settingsText = originalSettingsText.slice(0, startIndex)
            settingsText += originalSettingsText.slice(endIndex + 1)
        }
        settingsText = settingsText.replace(columnStartSyntax, "column-settings")
        
        let replacementText = `${columnStartLine}\n${settingsText}`

        offset += replacementText.length - matchLength

        updatedFileContent = updatedFileContent.slice(0, startIndex) + replacementText + updatedFileContent.slice(endIndex)
        console.groupCollapsed()
        console.log("Original File:\n\n", originalFileContent)
        console.log("Updated File:\n\n", updatedFileContent)
        console.groupEnd()
    }

    return {
        updatedFileContent: updatedFileContent,
        numRegionsUpdated: matches.length
    }
}