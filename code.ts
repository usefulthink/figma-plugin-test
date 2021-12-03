figma.showUI(__html__);

figma.ui.onmessage = async (msg) => {
  if (msg.type === "run-replacements") {
    // for now this will only do replacements in instance-nodes (only selects the
    // first one, but doing replacements in all of them wouold work the same way)
    const userNode = figma.currentPage.findOne(
      (node) => node.type === "INSTANCE" && node.name.includes("(user)")
    ) as InstanceNode | null;

    // this would usually run in all found nodes, each with a different set of
    // placeholders.
    if (userNode !== null) {
      await replacePlaceholders(userNode, {
        firstName: "Martin",
        lastName: "Schuh",
      });
    }
  }

  // all done.
  figma.closePlugin();
};

async function replacePlaceholders(
  rootNode: InstanceNode,
  placeholders: Record<string, string>
) {
  // search all text-nodes within the instance and let typescript know
  // that the result is indeed a TextNode[].
  const textNodes = rootNode.findAll(
    (node) => node.type === "TEXT"
  ) as TextNode[];

  // if we don't find any text-nodes there is nothing to do
  if (textNodes.length === 0) {
    return;
  }

  // in every textNode found in the instance, we replace all occurences of
  // the placeholder (e.g. "${firstName}") with the corresponding value
  // from the placeholders-object.
  for (let node of textNodes) {
    console.log(
      `running replacements in %o (characters: "${node.characters}")`,
      node
    );

    // make sure all fonts are loaded prior to starting text-replacements
    const fonts = node.getRangeAllFontNames(0, node.characters.length);
    for (const font of fonts) {
      await figma.loadFontAsync(font);
    }

    // not sure if we can handle missing fonts properly, safer to not try
    if (node.hasMissingFont) {
      console.error("replacement failed, node %o has missing fonts", node);
      continue;
    }

    // `placeholders` is an object (like `{firstName: "Martin", lastName: "Schuhfuss"}`)
    // with keys (firstName / lastName) and values (Martin / Schuhfuss).
    // `Object.entries()` will turn this into a list of key/value pairs like
    // [["firstName", "Martin"], ["lastName", "Schuhfuss"]].
    // Now we can use a for..of loop to get all pairs
    for (let [key, replacementText] of Object.entries(placeholders)) {
      const placeholderText = `$\{${key}}`;
      console.log(`  ${placeholderText} --> ${replacementText}`);

      replaceText(node, placeholderText, replacementText);
    }
  }

  // finally, store the data used for replacements as plugin-data, in case
  // it has to re-run
  rootNode.setPluginData("placeholders", JSON.stringify(placeholders));
}

function replaceText(node: TextNode, search: string, replacement: string) {
  let searchStartIndex = node.characters.indexOf(search);

  // placeholder not found?
  if (searchStartIndex === -1) {
    return;
  }

  // this looks a bit weird, but it works to preserve styles:
  //  - first, insert the new text before the placeholder and copy the style
  //    from the first character of the placeholder:
  node.insertCharacters(searchStartIndex, replacement, "AFTER");

  //  - now the node contains both the replacement text and the placeholder,
  //    which is removed now:
  searchStartIndex = searchStartIndex + replacement.length;
  node.deleteCharacters(searchStartIndex, searchStartIndex + search.length);
}
