import { confirmAlert, environment, Alert } from "@raycast/api";

import { basename, extname } from "path";
import { readdir, lstatSync } from "fs";

import { Pocket, Card, CardForm } from "./types"

export async function loadGrid(): Promise<Pocket[]> {
	return fetchFiles(environment.supportPath)
}

async function fetchFiles(dir: string): Promise<Pocket[]> {
	const pocketArr: Pocket[] = []

	loadPocketCards(dir)
	.then(cards => {
		pocketArr.push({ name: "Unsorted", cards: cards })
	})
	readdir(environment.supportPath, (err, items: string[]) => {
		items.forEach(item => {
			const filePath = `${dir}/${item}`
			const fileStats = lstatSync(filePath)
			const fileExt = extname(filePath)
			const fileName = basename(filePath, fileExt)

			if (!fileStats.isDirectory()) return;
			if (fileName.startsWith(".")) return;

			loadPocketCards(`${dir}/${item}`)
			.then(cards => {
				pocketArr.push({ name: item, cards: cards})
			})
		})
	})

	return pocketArr;
}

async function loadPocketCards(dir :string): Promise<Card[]> {
	const cardArr: Card[] = []

	readdir(dir, (err, items: string[]) => {
		items.forEach(item => {
			const filePath = `${dir}/${item}`;

			let fileStats = lstatSync("/")
			if (!filePath.includes(".DS_Store")) fileStats = lstatSync(filePath)

			//const fileStats = lstatSync(filePath)
			const fileExt = extname(filePath)
			const fileName = basename(filePath, fileExt)

			if (fileStats.isDirectory()) return;
			if (fileName.startsWith(".")) return;

			if (fileName.startsWith(".")) return;

			cardArr.push({ name: fileName, path: filePath });
		})
	})

	return cardArr
}

/*
export async function fetchFiles() {
	const cardArr: Array<CardItem> = []

	readdir(environment.supportPath, (err, topLevelItems: string[]) => {
		topLevelItems.forEach(topLevelItem => {
			const filePath = `${environment.supportPath}/${topLevelItem}`;
			const fileStats = lstatSync(filePath)

			if (fileStats.isDirectory()) {
				const cardSubArr: Array<Array<CardItem> = []

				readdir(environment.supportPath + topLevelItem, (err, subLevelItems: string[]) => {
					subLevelItems.forEach(subLevelItem => {
						const subFilePath = `${environment.supportPath}/${topLevelItem}/${subLevelItem}`
						const subFileStats = lstatSync(subFilePath)
						const subFileExt = extname(subFilePath)
						const subFileName = basename(subFilePath, subFileExt)

						if (subFileStats.isDirectory()) return;
						cardSubArr.push({ name: subFileName, path: subFilePath, folder: topLevelItem})
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
*/

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
