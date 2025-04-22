import React from 'react';

const AccountInfo = ({ info }) => {
    // Define the assets you want to display
    const desiredAssets = ['BTC', 'USDT', 'BNB', 'ETH']; // Add or remove assets as needed

    if (!info) {
        return <div className="section">Loading Account Info...</div>;
    }

    // Filter for desired assets AND non-zero balance
    const filteredBalances = info.balances?.filter(b =>
        desiredAssets.includes(b.asset) && (parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    );

    return (
        <div className="account-info section">
            <h2>Account Information</h2>
            <p><strong>Account Type:</strong> {info.accountType}</p>
            <p><strong>Can Trade:</strong> {info.canTrade ? 'Yes' : 'No'}</p>
            <p><strong>UID:</strong> {info.uid}</p>
            <h3>Filtered Balances ({desiredAssets.join(', ')})</h3>
            {filteredBalances && filteredBalances.length > 0 ? (
                <table>
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Free</th>
                            <th>Locked</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBalances.map(balance => (
                            <tr key={balance.asset}>
                                <td>{balance.asset}</td>
                                <td>{parseFloat(balance.free).toFixed(8)}</td>
                                <td>{parseFloat(balance.locked).toFixed(8)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No relevant non-zero balances found for {desiredAssets.join(', ')}.</p>
            )}
        </div>
    );
};

export default AccountInfo; 