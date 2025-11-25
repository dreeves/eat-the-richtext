# Eat The Richtext

Type or paste text on the left or right side and watch it convert itself on the other side. It's pretty self-explanatory!

The problem this is solving is, you know how if you copy/paste formatted text (aka rich text aka RTF) into Discord or GitHub or other places that expect plain text, it destroys all the formatting? Which is *mostly* exactly what you want but some things -- in particular italics -- are very important to preserve. Losing the italics can totally change the meaning!

(You also lose sub- and superscripts, the numbers in a numbered list, bullets in a bulleted list, nesting of lists, links, tables, headers/subheaders, blockquotes, code blocks, etc.)

So now instead of painstakingly putting underscores or stars around the italicized words, renumbering lists, and otherwise markdownifying the lost formatting, you can paste into the left side of this rich text eater and have that done by magic on the right side.

(Or if you're a weirdo who likes WYSIWYG you can use the left side as an editor and see the corresponding markdown on the right. Or vice versa. You can even jump back and forth, like if you forget the markdown syntax for something. Whatever you like!)

<br>

This is free. If you find it useful and want to express your gratitude, maybe sign up for <a href="https://www.beeminder.com" title="Goal tracking with teeth">Beeminder</a>? Or at least use my <a href="https://www.codebuff.com/referrals/ref-146ce36c-53e8-435c-a7f6-e180206dd0ee" title="Codebuff didn't exist when I first made this but it's been helpful in improving it">referral link</a> to sign up for Codebuff?

<br>

More backstory <a href="https://www.lesswrong.com/posts/fFu4tZom8twYdEyeD/eat-the-richtext" title="All these things link to each other now">on LessWrong</a>. And the source code is <a href="https://github.com/dreeves/eat-the-richtext" title="So many links. Original blurb on LessWrong, proper LessWrong post, at least two URLs for the hosted tool itself, source on GitHub, source on Replit, ...">on GitHub</a>.

<br>

## Other features

Sometimes you paste in text with non-breaking spaces all over the place (at least this happened to me once when copying text from [dynomight.net](https://dynomight.net "Incidentally one of my favorite blogs")). You can tell because the text doesn't wrap correctly. If you press the ✨ button, it fixes the whitespace. Should it do that automatically?

<br>

## Sample richtext to try pasting in

<ol>
<li><em>Italics</em> and <strong>bold</strong></li>
<li>Sub- or superscripts, like <em>a</em><sup>2</sup> + <em>b</em><sup>2</sup> = <em>c</em><sup>2</sup></li>
<li>The numbers in a numbered list</li>
<li>The bullets in a bulleted list
  <ol>
  <li>Also nesting of lists</li>
  </ol></li>
<li>Hyperlinks like <a href="https://eat-the-richtext.dreev.es/">eat-the-richtext</a></li>
<li><table>
<tr><th>Tables</th><th>Chairs</th></tr>
<tr><td>data</td><td>electric</td></tr>
<tr><td>furniture</td><td></td></tr>
</table></li>
<li><h2>Headers</h2> and <h3>subheaders</h3></li>
<li><blockquote>Blockquotes</blockquote></li>
<li><s>Strikethrough</s></li>
<li><code>&lt;Code&gt;</code></li>
</ol>