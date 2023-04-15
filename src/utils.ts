import { confirmAlert, environment, Alert } from "@raycast/api";

import { basename, extname } from "path";
import { readdir, lstatSync } from "fs";

import { CardItem, CardForm } from "./types"

export async function fetchFiles() {
	const cardArr: Array<CardItem> = []

	readdir(environment.supportPath, (err, topLevelItems: string[]) => {
		topLevelItems.forEach(topLevelItem => {
			const filePath = `${environment.supportPath}/${topLevelItem}`;
			const fileStats = lstatSync(filePath)

			if (fileStats.isDirectory()) {
				readdir(environment.supportPath + topLevelItem, (err, subLevelItems: string[]) => {
					subLevelItems.forEach(subLevelItem => {
						const subFilePath = `${environment.supportPath}/${topLevelItem}/${subLevelItem}`
						const subFileStats = lstatSync(subFilePath)
						const subFileExt = extname(subFilePath)
						const subFileName = basename(subFilePath, subFileExt)

						if (subFileStats.isDirectory()) return;
						cardArr.push({ name: subFileName, path: subFilePath, folder: topLevelItem})
					})
				})
			} else {
				const fileExt = extname(filePath)
				const fileName = basename(filePath, fileExt)

				if (fileName.startsWith(".")) return;
				cardArr.push({ name: fileName, path: filePath });
			}
		});
	});

	return cardArr
}

export function createCard(values: CardForm) {
	console.log(`Created ${values.name}`)
}

export function editCard(name: string) {
	console.log(`Editing ${name}`);
}
export function deleteCard(name: string) {
	console.log(`Deleted ${name}`);
}
export function deletePocket(pocket: string) {
	console.log(`Deleted ${pocket}`);
}
export async function deleteAll(): Promise<void> {
	const options: Alert.Options = {
		title: "Delete All Cards",
		icon: { source: "extension-icon.png" },
		message: "Are you sure you want to delete all Cards?",
		primaryAction: {
			title: "Delete All",
			style: Alert.ActionStyle.Destructive,
		},
	};

	if (await confirmAlert(options)) {
		console.log("Deleted all Cards.");
	}
}
