import React, { useState } from 'react';
import { Database, Search, HelpCircle } from 'lucide-react';

export default function Dataset({ goldenDataset }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredDataset = goldenDataset.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.expected_answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
          <Database size={18} style={{ color: 'var(--accent-indigo)' }} />
          Golden Evaluation Benchmark Dataset
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              placeholder="Search benchmark..."
              className="form-input"
              style={{ paddingLeft: '32px', width: '220px', height: '36px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="form-select" style={{ width: '180px', height: '36px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Domains</option>
            <option value="Customer Support">Customer Support</option>
            <option value="Technical & Coding">Technical & Coding</option>
            <option value="Financial & Data Extraction">Finance & Data</option>
            <option value="Legal & Document Analysis">Legal & Contract</option>
          </select>
        </div>
      </div>

      <div className="dataset-table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th style={{ width: '150px' }}>Category</th>
              <th>Test Question / Query</th>
              <th>Expected Ground Truth</th>
              <th>Reference Document Context</th>
            </tr>
          </thead>
          <tbody>
            {filteredDataset.map((item) => (
              <tr key={item.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.id}</td>
                <td><span className="tag-pill">{item.category}</span></td>
                <td style={{ fontSize: '0.85rem', fontWeight: 550 }}>{item.question}</td>
                <td style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)' }}>{item.expected_answer}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.reference_context}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
