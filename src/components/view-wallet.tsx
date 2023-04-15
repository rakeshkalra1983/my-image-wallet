import { environment, Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import NewCard from "../components/newCard"
import { deleteCard, deletePocket, deleteAll, editCard, fetchFiles } from "../utils";
import { Card } from "../types";
import { ReactNode } from "react";

export default function Wallet() {
	const { isLoading, data, revalidate } = usePromise(gridContent);

	return (
		<Grid
			columns={5}
			isLoading={isLoading}
			inset={Grid.Inset.Large}
			navigationTitle="Image Wallet"
			searchBarPlaceholder="Search Cards..."
			actions={
				editAction()
			  }
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
				<Grid.Section title={pocket.name} key={pocket.name || "unsorted"}>
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

function cardActions(item: Card) { return (
	<ActionPanel>
		<ActionPanel.Section>
			<Action.Paste content={{ file: item.path }} />
			<Action.CopyToClipboard content={{ file: item.path }} />
		</ActionPanel.Section>
		{editAction()}
	</ActionPanel>
)}

function editAction() { return (
	<ActionPanel.Section>
		<Action.ShowInFinder
			title="Edit Wallet"
			shortcut={{modifiers: ["cmd"], key: "e"}}
			path={environment.supportPath}
		/>
	</ActionPanel.Section>
)}