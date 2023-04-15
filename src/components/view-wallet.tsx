import { environment, Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import NewCard from "../components/newCard"
import { deleteCard, deletePocket, deleteAll, editCard, fetchFiles } from "../utils";
import { Card } from "../types";
import { ReactNode } from "react";

export default function Wallet() {
	const { isLoading, data } = usePromise(gridContent);

	return (
		<Grid
			columns={5}
			isLoading={isLoading}
			inset={Grid.Inset.Large}
			navigationTitle="Image Wallet"
			searchBarPlaceholder="Search Cards..."
			//searchBarAccessory={gridDropdown()}
		>
			{ data }
		</Grid>
	);
}

async function gridContent() {
	const outPockets:ReactNode[] = []

	fetchFiles(environment.supportPath).then(pockets => {
		pockets.forEach((pocket) => {
			outPockets.push(
				<Grid.Section title={pocket.name} key={pocket.name}>
					{pocket.cards.map(card => (
						<Grid.Item
							key={card.path}
							content={card.path}
							title={card.name}
							actions={cardActions(card)}
						/>
					))}
				</Grid.Section>
			)
		})
	})

	return outPockets
}

/* function gridDropdown() { return (
	<Grid.Dropdown tooltip="Pocket">
		<Grid.Dropdown.Item
			title="All Cards"
			value="All Cards"
		/>
		<Grid.Dropdown.Section>
			<Grid.Dropdown.Item
				title="New Pocket"
				value="New Pocket"
				icon={Icon.NewFolder}
			/>
		</Grid.Dropdown.Section>
		<Grid.Dropdown.Section title="Pockets">
			<Grid.Dropdown.Item
				title="Garfield"
				value="Garfield"
			/>
			<Grid.Dropdown.Item
				title="Soyjaks"
				value="Soyjaks"
			/>
		</Grid.Dropdown.Section>
	</Grid.Dropdown>
)} */

function cardActions(item: Card) {return (
	<ActionPanel>
		<ActionPanel.Section>
			<Action.Paste content={{ file: item.path }} />
			<Action.CopyToClipboard content={{ file: item.path }} />
		</ActionPanel.Section>
		<ActionPanel.Section>
			<Action
				title="Edit Card"
				icon={Icon.Pencil}
				shortcut={{ modifiers: ["cmd"], key: "e" }}
				onAction={() => editCard(item.name)}
			/>
			<Action.Push
				title="New Card"
				icon={Icon.PlusSquare}
				shortcut={{ modifiers: ["cmd"], key: "n" }}
				target={<NewCard />}
			/>
		</ActionPanel.Section>
		<ActionPanel.Section>
			<Action
				title="Delete Card"
				icon={Icon.Trash}
				shortcut={{ modifiers: ["ctrl"], key: "x" }}
				style={Action.Style.Destructive}
				onAction={() => deleteCard(item.name)}
			/>
			<Action
				title="Delete All Cards in Pocket"
				icon={Icon.Folder}
				shortcut={{ modifiers: ["ctrl"], key: "x" }}
				style={Action.Style.Destructive}
				onAction={() => deletePocket(item.name)}
			/>
			<Action
				title="Delete All Cards in Wallet"
				icon={Icon.Wallet}
				shortcut={{ modifiers: ["ctrl", "shift"], key: "x" }}
				style={Action.Style.Destructive}
				onAction={() => deleteAll()}
			/>
		</ActionPanel.Section>
	</ActionPanel>
)}