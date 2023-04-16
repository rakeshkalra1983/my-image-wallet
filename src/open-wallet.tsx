import { openExtensionPreferences, ActionPanel, Action, Grid, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { ReactNode } from "react";

import { walletPath, fetchFiles } from "./utils";
import { Card } from "./types";

export default function Command() {
	const { isLoading, data } = usePromise(loadGridComponents);

	return (
		<Grid
			columns={5}
			isLoading={isLoading}
			inset={Grid.Inset.Large}
			navigationTitle="Image Wallet"
			searchBarPlaceholder="Search Cards..."
			actions={
				<ActionPanel>
					{ loadEditActions() }
				</ActionPanel>
			  }
		>
			{ data }
		</Grid>
	);
}

async function loadGridComponents() {
	const outPockets:ReactNode[] = []

	fetchFiles(walletPath).then(pockets => {
		pockets.forEach((pocket) => { outPockets.push(
			<Grid.Section title={pocket.name} key={pocket.name || "unsorted"}>
				{pocket.cards.map(card => (
					<Grid.Item
						key={card.path}
						content={card.path}
						title={card.name}
						actions={loadCardActions(card)}
					/>
				))}
			</Grid.Section>
		)})
	})

	return outPockets
}

function loadCardActions(item: Card) { return (
	<ActionPanel>
		<ActionPanel.Section>
			<Action.Paste content={{ file: item.path }} />
			<Action.CopyToClipboard content={{ file: item.path }} />
		</ActionPanel.Section>
		{loadEditActions()}
	</ActionPanel>
)}

function loadEditActions() { return (
	<ActionPanel.Section>
		<Action.ShowInFinder
			title="Open Wallet in Finder"
			shortcut={{ modifiers: ["cmd"], key: "e" }}
			path={walletPath}
		/>
		<Action
			title="Change Wallet Directory"
			icon={Icon.Folder}
			shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
			onAction={openExtensionPreferences}
		/>
	</ActionPanel.Section>
)}